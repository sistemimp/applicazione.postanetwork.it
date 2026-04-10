"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCsrfCookie = setCsrfCookie;
exports.verifyCsrfToken = verifyCsrfToken;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
/**
 * SH1: CSRF protection for the admin panel.
 *
 * Strategy: Double-submit cookie pattern.
 * - A random CSRF token is set as a cookie (csrf_token).
 * - The client must send the same token in the X-CSRF-Token header.
 * - On every state-changing request (POST/PUT/DELETE), the middleware
 *   verifies that the header matches the cookie.
 */
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
// Safe methods that don't need CSRF protection
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/**
 * Middleware to set the CSRF cookie if not present.
 * Should be applied to routes that serve the admin panel.
 */
function setCsrfCookie(req, res, next) {
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
        const token = crypto_1.default.randomBytes(32).toString('hex');
        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: false, // Client JS needs to read it for the header
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 8 * 60 * 60 * 1000, // 8 hours
        });
    }
    next();
}
/**
 * Middleware to verify CSRF token on state-changing requests.
 * Compares the cookie value against the X-CSRF-Token header.
 */
function verifyCsrfToken(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        next();
        return;
    }
    // API key requests are not from browsers — skip CSRF
    if (req.headers['x-api-key']) {
        next();
        return;
    }
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];
    if (!cookieToken || !headerToken) {
        (0, logger_1.log)('warn', 'CSRF token missing', {
            method: req.method,
            path: req.path,
            hasCookie: !!cookieToken,
            hasHeader: !!headerToken,
        });
        res.status(403).json({ error: 'Token CSRF mancante. Ricarica la pagina.' });
        return;
    }
    // Constant-time comparison to prevent timing attacks
    if (cookieToken.length !== headerToken.length ||
        !crypto_1.default.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
        (0, logger_1.log)('warn', 'CSRF token mismatch', { method: req.method, path: req.path });
        res.status(403).json({ error: 'Token CSRF non valido. Ricarica la pagina.' });
        return;
    }
    next();
}
//# sourceMappingURL=csrf.js.map