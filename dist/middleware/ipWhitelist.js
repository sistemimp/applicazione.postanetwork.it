"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipWhitelistMiddleware = ipWhitelistMiddleware;
exports.getCurrentIp = getCurrentIp;
exports.invalidateIpWhitelistCache = invalidateIpWhitelistCache;
const connection_1 = require("../db/connection");
const logger_1 = require("../utils/logger");
// In-memory cache
let cachedConfig = { enabled: false, allowed_ips: [] };
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
async function loadIpWhitelistConfig() {
    const now = Date.now();
    if (now - lastFetchTime < CACHE_TTL_MS) {
        return cachedConfig;
    }
    try {
        // Check if app_config table exists
        const exists = await connection_1.dbTrack.schema.hasTable('app_config');
        if (!exists) {
            lastFetchTime = now;
            return cachedConfig;
        }
        const row = await (0, connection_1.dbTrack)('app_config').where({ chiave: 'ip_whitelist' }).first();
        if (row && row.valore) {
            cachedConfig = JSON.parse(row.valore);
        }
        else {
            cachedConfig = { enabled: false, allowed_ips: [] };
        }
        lastFetchTime = now;
    }
    catch (err) {
        (0, logger_1.log)('error', 'Failed to load IP whitelist config', { error: err.message });
        // On error, keep the cached config (fail-open if never loaded, fail-closed if previously loaded)
    }
    return cachedConfig;
}
/**
 * Get the client IP address from the request.
 */
function getClientIp(req) {
    // Trust X-Forwarded-For if behind a proxy (e.g., Railway, Nginx)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const firstIp = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
        return firstIp;
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
}
/**
 * Middleware that checks IP whitelist for admin routes.
 * Applied ONLY to admin routes. If disabled, passes through.
 */
async function ipWhitelistMiddleware(req, res, next) {
    try {
        const config = await loadIpWhitelistConfig();
        if (!config.enabled || config.allowed_ips.length === 0) {
            next();
            return;
        }
        const clientIp = getClientIp(req);
        // Check if IP is in allowed list
        const isAllowed = config.allowed_ips.some((allowedIp) => {
            // Support exact match and safe wildcard (e.g., 192.168.1.*)
            if (allowedIp.includes('*')) {
                // Validate IP pattern format: only allow digits, dots, and single * per octet
                if (!/^[\d.*]+$/.test(allowedIp) || allowedIp.split('.').length > 4) {
                    return false; // Reject malformed patterns to prevent ReDoS
                }
                const pattern = allowedIp.replace(/\./g, '\\.').replace(/\*/g, '\\d+');
                return new RegExp(`^${pattern}$`).test(clientIp);
            }
            return allowedIp === clientIp;
        });
        if (!isAllowed) {
            (0, logger_1.log)('warn', 'Admin access blocked by IP whitelist', { clientIp, allowedIps: config.allowed_ips });
            res.status(403).json({
                error: 'Accesso negato. Il tuo IP non e\' autorizzato.',
                yourIp: clientIp,
            });
            return;
        }
        next();
    }
    catch (err) {
        (0, logger_1.log)('error', 'IP whitelist middleware error', { error: err.message });
        // SH7: Fail closed on error — return 503 instead of allowing access
        res.status(503).json({
            error: 'Servizio temporaneamente non disponibile. Errore nel controllo IP whitelist.',
        });
    }
}
/**
 * Endpoint to get the client's current IP address (used by admin panel).
 */
function getCurrentIp(req, res) {
    const clientIp = getClientIp(req);
    res.json({ ip: clientIp });
}
/**
 * Force refresh the cached IP whitelist config.
 */
function invalidateIpWhitelistCache() {
    lastFetchTime = 0;
}
//# sourceMappingURL=ipWhitelist.js.map