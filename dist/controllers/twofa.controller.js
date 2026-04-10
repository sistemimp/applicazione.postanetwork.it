"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setup2FA = setup2FA;
exports.verify2FA = verify2FA;
exports.disable2FA = disable2FA;
exports.login2FA = login2FA;
exports.generateTempToken = generateTempToken;
const otplib = __importStar(require("otplib"));
const QRCode = __importStar(require("qrcode"));
const connection_1 = require("../db/connection");
const auth_service_1 = require("../services/auth.service");
const logger_1 = require("../utils/logger");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const authService = new auth_service_1.AuthService();
// Ensure totp columns exist on users table
async function ensureTotpColumns() {
    const hasSecret = await connection_1.dbTrack.schema.hasColumn('users', 'totp_secret');
    if (!hasSecret) {
        await connection_1.dbTrack.schema.alterTable('users', (table) => {
            table.string('totp_secret', 255).nullable();
        });
    }
    const hasEnabled = await connection_1.dbTrack.schema.hasColumn('users', 'totp_enabled');
    if (!hasEnabled) {
        await connection_1.dbTrack.schema.alterTable('users', (table) => {
            table.boolean('totp_enabled').defaultTo(false);
        });
    }
}
// POST /api/v1/auth/2fa/setup — Generate TOTP secret and QR code
async function setup2FA(req, res) {
    try {
        await ensureTotpColumns();
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Non autenticato' });
            return;
        }
        const user = await (0, connection_1.dbTrack)('users').where({ id: userId }).first();
        if (!user) {
            res.status(404).json({ error: 'Utente non trovato' });
            return;
        }
        if (user.totp_enabled) {
            res.status(400).json({ error: '2FA gia\' abilitato. Disabilita prima di riconfigurare.' });
            return;
        }
        // Generate secret
        const secret = otplib.generateSecret();
        // Save secret (not yet enabled)
        await (0, connection_1.dbTrack)('users').where({ id: userId }).update({ totp_secret: secret });
        // Generate otpauth URL
        const otpauthUrl = otplib.generateURI({ issuer: 'Posta Network', label: user.username, secret });
        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
        (0, logger_1.log)('info', '2FA setup initiated', { userId, username: user.username });
        // L3: Only return QR code, not the raw secret string — users should scan the QR code
        res.json({
            qrCode: qrCodeDataUrl,
            message: 'Scansiona il QR code con Google Authenticator o un\'app compatibile.',
        });
    }
    catch (err) {
        (0, logger_1.log)('error', '2FA setup error', { error: err.message });
        res.status(500).json({ error: 'Errore nella configurazione 2FA' });
    }
}
// POST /api/v1/auth/2fa/verify — Verify TOTP code and enable 2FA
async function verify2FA(req, res) {
    try {
        await ensureTotpColumns();
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Non autenticato' });
            return;
        }
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ error: 'Codice TOTP obbligatorio' });
            return;
        }
        const user = await (0, connection_1.dbTrack)('users').where({ id: userId }).first();
        if (!user || !user.totp_secret) {
            res.status(400).json({ error: 'Configurazione 2FA non trovata. Esegui prima il setup.' });
            return;
        }
        const isValid = otplib.verifySync({ token: code, secret: user.totp_secret });
        if (!isValid) {
            res.status(400).json({ error: 'Codice non valido. Riprova.' });
            return;
        }
        // Enable 2FA
        await (0, connection_1.dbTrack)('users').where({ id: userId }).update({ totp_enabled: true });
        (0, logger_1.log)('info', '2FA enabled', { userId, username: user.username });
        res.json({ message: 'Autenticazione a 2 fattori abilitata con successo.' });
    }
    catch (err) {
        (0, logger_1.log)('error', '2FA verify error', { error: err.message });
        res.status(500).json({ error: 'Errore nella verifica 2FA' });
    }
}
// POST /api/v1/auth/2fa/disable — Disable 2FA (requires current password)
async function disable2FA(req, res) {
    try {
        await ensureTotpColumns();
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Non autenticato' });
            return;
        }
        const { password } = req.body;
        if (!password) {
            res.status(400).json({ error: 'Password obbligatoria per disabilitare 2FA' });
            return;
        }
        const user = await (0, connection_1.dbTrack)('users').where({ id: userId }).first();
        if (!user) {
            res.status(404).json({ error: 'Utente non trovato' });
            return;
        }
        const valid = await authService.verifyPassword(password, user.password_hash);
        if (!valid) {
            res.status(401).json({ error: 'Password non corretta' });
            return;
        }
        await (0, connection_1.dbTrack)('users').where({ id: userId }).update({
            totp_enabled: false,
            totp_secret: null,
        });
        (0, logger_1.log)('info', '2FA disabled', { userId, username: user.username });
        res.json({ message: 'Autenticazione a 2 fattori disabilitata.' });
    }
    catch (err) {
        (0, logger_1.log)('error', '2FA disable error', { error: err.message });
        res.status(500).json({ error: 'Errore nella disabilitazione 2FA' });
    }
}
// POST /api/v1/auth/2fa/login — Complete login with TOTP code
async function login2FA(req, res) {
    try {
        await ensureTotpColumns();
        const { tempToken, code } = req.body;
        if (!tempToken || !code) {
            res.status(400).json({ error: 'Token temporaneo e codice TOTP obbligatori' });
            return;
        }
        // Verify temp token
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(tempToken, config_1.config.jwt.secret + ':2fa_temp');
        }
        catch {
            res.status(401).json({ error: 'Token temporaneo scaduto o non valido' });
            return;
        }
        const user = await (0, connection_1.dbTrack)('users').where({ id: payload.userId }).first();
        if (!user || !user.totp_secret || !user.totp_enabled) {
            res.status(400).json({ error: '2FA non configurato per questo utente' });
            return;
        }
        const isValid = otplib.verifySync({ token: code, secret: user.totp_secret });
        if (!isValid) {
            res.status(400).json({ error: 'Codice 2FA non valido' });
            return;
        }
        // Generate real tokens
        const tokens = authService.generateTokens({
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions || null,
        });
        // Save hashed refresh token
        await (0, connection_1.dbTrack)('refresh_tokens').insert({
            user_id: user.id,
            token: authService.hashToken(tokens.refreshToken),
            device_id: payload.device_id || null,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        (0, logger_1.log)('info', '2FA login successful', { userId: user.id, username: user.username });
        res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions || null,
            },
        });
    }
    catch (err) {
        (0, logger_1.log)('error', '2FA login error', { error: err.message });
        res.status(500).json({ error: 'Errore nel login 2FA' });
    }
}
// Generate a temporary token for 2FA flow (used by login controller)
function generateTempToken(userId, username, role, device_id) {
    return jsonwebtoken_1.default.sign({ userId, username, role, device_id, purpose: '2fa' }, config_1.config.jwt.secret + ':2fa_temp', { expiresIn: '5m' });
}
//# sourceMappingURL=twofa.controller.js.map