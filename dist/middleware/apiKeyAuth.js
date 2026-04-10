"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureApiKeysTable = ensureApiKeysTable;
exports.invalidateApiKeyCache = invalidateApiKeyCache;
exports.generateApiKey = generateApiKey;
exports.hashApiKey = hashApiKey;
exports.apiKeyAuthenticate = apiKeyAuthenticate;
exports.combinedAuth = combinedAuth;
exports.checkApiKeyPermission = checkApiKeyPermission;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const connection_1 = require("../db/connection");
const auth_service_1 = require("../services/auth.service");
// ════════════════════════════════════════════════════
// API Keys table auto-creation
// ════════════════════════════════════════════════════
async function ensureApiKeysTable() {
    const exists = await connection_1.dbTrack.schema.hasTable('api_keys');
    if (!exists) {
        await connection_1.dbTrack.schema.createTable('api_keys', (table) => {
            table.increments('id').primary();
            table.string('name', 255).notNullable();
            table.string('key_prefix', 20).notNullable();
            table.string('key_hash', 255).notNullable();
            table.text('permissions').notNullable(); // JSON array: ['read','write','all']
            table.timestamp('last_used_at').nullable();
            table.string('last_used_ip', 100).nullable();
            table.integer('requests_count').defaultTo(0);
            table.boolean('active').defaultTo(true);
            table.timestamp('created_at').defaultTo(connection_1.dbTrack.fn.now());
            table.integer('created_by').nullable();
            table.index(['key_prefix']);
            table.index(['active']);
        });
    }
}
// Run on import
ensureApiKeysTable().catch(err => console.error('Failed to ensure api_keys table:', err));
const keyCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute (reduced for faster key revocation)
function getCachedKey(rawKey) {
    const cached = keyCache.get(rawKey);
    if (!cached)
        return null;
    if (Date.now() - cached.validatedAt > CACHE_TTL_MS) {
        keyCache.delete(rawKey);
        return null;
    }
    return cached;
}
const MAX_CACHE_SIZE = 1000;
function setCachedKey(rawKey, data) {
    // Evict oldest entry if cache is full
    if (keyCache.size >= MAX_CACHE_SIZE) {
        const firstKey = keyCache.keys().next().value;
        if (firstKey)
            keyCache.delete(firstKey);
    }
    keyCache.set(rawKey, data);
}
// Exported to invalidate cache when keys are modified
function invalidateApiKeyCache() {
    keyCache.clear();
}
// ════════════════════════════════════════════════════
// API Key generation
// ════════════════════════════════════════════════════
function generateApiKey() {
    const randomPart = crypto_1.default.randomBytes(24).toString('hex'); // 48 hex chars
    return `pk_live_${randomPart}`;
}
async function hashApiKey(key) {
    // L7: bcrypt cost factor 12 for stronger hashing (was 10)
    return bcryptjs_1.default.hash(key, 12);
}
// ════════════════════════════════════════════════════
// API Key authentication middleware
// ════════════════════════════════════════════════════
async function apiKeyAuthenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        res.status(401).json({ error: 'API Key mancante' });
        return;
    }
    try {
        // Check cache first
        const cached = getCachedKey(apiKey);
        if (cached) {
            // Set req.user for compatibility with existing auth
            req.user = {
                userId: cached.id,
                username: `api_key:${cached.name}`,
                role: 'api',
                permissions: cached.permissions,
            };
            // Update last_used_at and requests_count in background (don't await)
            const clientIp = req.ip || req.socket.remoteAddress || '';
            (0, connection_1.dbTrack)('api_keys')
                .where({ id: cached.id })
                .update({
                last_used_at: connection_1.dbTrack.fn.now(),
                last_used_ip: clientIp,
                requests_count: connection_1.dbTrack.raw('requests_count + 1'),
            })
                .catch(() => { }); // silent fail for usage tracking
            next();
            return;
        }
        // Extract prefix (first 12 chars) for initial filtering
        const prefix = apiKey.substring(0, 12);
        // Find candidate keys by prefix
        const candidates = await (0, connection_1.dbTrack)('api_keys')
            .where({ key_prefix: prefix, active: true })
            .select('id', 'name', 'key_hash', 'permissions');
        let matchedKey = null;
        for (const candidate of candidates) {
            const isMatch = await bcryptjs_1.default.compare(apiKey, candidate.key_hash);
            if (isMatch) {
                matchedKey = candidate;
                break;
            }
        }
        if (!matchedKey) {
            res.status(401).json({ error: 'API Key non valida o revocata' });
            return;
        }
        let permissions;
        try {
            permissions = JSON.parse(matchedKey.permissions);
        }
        catch {
            permissions = [];
        }
        // Cache the validated key
        setCachedKey(apiKey, {
            id: matchedKey.id,
            name: matchedKey.name,
            permissions,
            validatedAt: Date.now(),
        });
        // Set req.user
        req.user = {
            userId: matchedKey.id,
            username: `api_key:${matchedKey.name}`,
            role: 'api',
            permissions,
        };
        // Update usage stats in background
        const clientIp = req.ip || req.socket.remoteAddress || '';
        (0, connection_1.dbTrack)('api_keys')
            .where({ id: matchedKey.id })
            .update({
            last_used_at: connection_1.dbTrack.fn.now(),
            last_used_ip: clientIp,
            requests_count: connection_1.dbTrack.raw('requests_count + 1'),
        })
            .catch(() => { });
        next();
    }
    catch (err) {
        res.status(500).json({ error: 'Errore di autenticazione API Key' });
    }
}
// ════════════════════════════════════════════════════
// Combined auth: JWT first, then API Key
// ════════════════════════════════════════════════════
const authService = new auth_service_1.AuthService();
function combinedAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    // Try JWT first
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            req.user = authService.verifyAccessToken(token);
            next();
            return;
        }
        catch {
            // JWT failed, fall through to API Key check
        }
    }
    // Try API Key
    if (apiKey) {
        apiKeyAuthenticate(req, res, next);
        return;
    }
    // No auth provided
    res.status(401).json({ error: 'Autenticazione richiesta (JWT o API Key)' });
}
// ════════════════════════════════════════════════════
// Permission check for API Key requests
// ════════════════════════════════════════════════════
function checkApiKeyPermission(req, res, next) {
    // If not an API key user, skip check (JWT users handled by authorize())
    if (!req.user || req.user.role !== 'api') {
        next();
        return;
    }
    const permissions = req.user.permissions || [];
    const method = req.method.toUpperCase();
    // 'all' allows everything
    if (permissions.includes('all')) {
        next();
        return;
    }
    // 'write' allows GET + POST + PUT + DELETE
    if (permissions.includes('write')) {
        next();
        return;
    }
    // 'read' allows only GET
    if (permissions.includes('read')) {
        if (method === 'GET') {
            next();
            return;
        }
        res.status(403).json({ error: 'API Key con permesso solo lettura. Metodo non consentito: ' + method });
        return;
    }
    // No valid permissions
    res.status(403).json({ error: 'API Key senza permessi validi' });
}
//# sourceMappingURL=apiKeyAuth.js.map