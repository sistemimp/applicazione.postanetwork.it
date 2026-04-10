"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../utils/logger");
const connection_1 = require("../db/connection");
const crypto_1 = __importDefault(require("crypto"));
function sanitizeBody(body) {
    if (!body)
        return null;
    const sanitized = { ...body };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'refreshToken', 'currentPassword', 'newPassword'];
    for (const key of sensitiveKeys) {
        if (key in sanitized)
            sanitized[key] = '[REDACTED]';
    }
    return JSON.stringify(sanitized).substring(0, 2000);
}
// Save error to DB (fire-and-forget, never blocks the response)
async function saveErrorToDb(err, req, statusCode) {
    try {
        const errorHash = crypto_1.default.createHash('md5')
            .update(err.message + (req.path || ''))
            .digest('hex');
        // Check if same error already exists (by hash, unresolved)
        const existing = await (0, connection_1.dbTrack)('error_logs')
            .where({ error_hash: errorHash, resolved: false })
            .first();
        if (existing) {
            await (0, connection_1.dbTrack)('error_logs')
                .where({ id: existing.id })
                .update({
                occurrences: (existing.occurrences || 1) + 1,
                last_seen: connection_1.dbTrack.fn.now(),
                stack: err.stack || null,
            });
        }
        else {
            await (0, connection_1.dbTrack)('error_logs').insert({
                level: statusCode >= 500 ? 'error' : 'warning',
                message: err.message,
                stack: err.stack || null,
                endpoint: req.path || null,
                method: req.method || null,
                status_code: statusCode,
                user_id: req.user?.userId || null,
                username: req.user?.username || null,
                ip: req.ip || req.headers['x-forwarded-for'] || null,
                user_agent: (req.headers['user-agent'] || '').substring(0, 500) || null,
                request_body: sanitizeBody(req.body),
                error_hash: errorHash,
            });
        }
    }
    catch (dbErr) {
        (0, logger_1.log)('warn', 'Failed to save error to DB', { error: dbErr.message });
    }
}
function errorHandler(err, req, res, _next) {
    (0, logger_1.log)('error', `${req.method} ${req.path}`, {
        error: err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
    const statusCode = err.name === 'ValidationError' ? 400 : 500;
    // Save to DB (non-blocking)
    saveErrorToDb(err, req, statusCode);
    if (err.name === 'ValidationError') {
        // L1: Sanitize validation error messages — strip any internal schema/table details
        const safeMessage = err.message
            .replace(/table\s+`?\w+`?/gi, '[table]')
            .replace(/column\s+`?\w+`?/gi, '[column]')
            .replace(/schema\s+`?\w+`?/gi, '[schema]')
            .replace(/ER_\w+/g, '[db_error]')
            .substring(0, 500);
        res.status(400).json({ error: safeMessage });
        return;
    }
    // L1: Never expose internal error details in 500 responses
    res.status(500).json({ error: 'Errore interno del server' });
}
//# sourceMappingURL=errorHandler.js.map