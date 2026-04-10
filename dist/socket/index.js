"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSocketRateLimit = checkSocketRateLimit;
exports.rateLimitedHandler = rateLimitedHandler;
exports.setupSocket = setupSocket;
const auth_service_1 = require("../services/auth.service");
const geolocation_handler_1 = require("./geolocation.handler");
const notifications_handler_1 = require("./notifications.handler");
const deviceStatus_handler_1 = require("./deviceStatus.handler");
const logger_1 = require("../utils/logger");
const authService = new auth_service_1.AuthService();
const rateLimitBuckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_CHAT_PER_MINUTE = 60;
const MAX_HEARTBEAT_PER_MINUTE = 120;
function getRateBucket(userId) {
    const now = Date.now();
    let bucket = rateLimitBuckets.get(userId);
    if (!bucket || now >= bucket.resetAt) {
        bucket = { chatCount: 0, heartbeatCount: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
        rateLimitBuckets.set(userId, bucket);
    }
    return bucket;
}
/**
 * Check rate limit for a given event type. Returns true if within limit, false if exceeded.
 */
function checkSocketRateLimit(userId, type) {
    const bucket = getRateBucket(userId);
    if (type === 'chat') {
        bucket.chatCount++;
        return bucket.chatCount <= MAX_CHAT_PER_MINUTE;
    }
    else {
        bucket.heartbeatCount++;
        return bucket.heartbeatCount <= MAX_HEARTBEAT_PER_MINUTE;
    }
}
/**
 * Wraps a socket event handler with rate limiting.
 * If the rate limit is exceeded, disconnects the socket with an error.
 */
function rateLimitedHandler(socket, userId, type, handler) {
    return (...args) => {
        if (!checkSocketRateLimit(userId, type)) {
            const msg = type === 'chat'
                ? `Rate limit superato: max ${MAX_CHAT_PER_MINUTE} messaggi/minuto`
                : `Rate limit superato: max ${MAX_HEARTBEAT_PER_MINUTE} heartbeat/minuto`;
            (0, logger_1.log)('warn', 'Socket rate limit exceeded', { userId, type });
            socket.emit('error', { message: msg });
            socket.disconnect(true);
            return;
        }
        handler(...args);
    };
}
// Clean up stale buckets every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [userId, bucket] of rateLimitBuckets) {
        if (now >= bucket.resetAt) {
            rateLimitBuckets.delete(userId);
        }
    }
}, 5 * 60 * 1000);
function setupSocket(io) {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Token mancante'));
        }
        try {
            const payload = authService.verifyAccessToken(token);
            socket.data.user = payload;
            next();
        }
        catch {
            next(new Error('Token non valido'));
        }
    });
    io.on('connection', (socket) => {
        const user = socket.data.user;
        (0, logger_1.log)('info', 'Socket connected', { userId: user.userId, username: user.username });
        socket.join(`user:${user.userId}`);
        socket.join(`role:${user.role}`);
        // Join permission-based rooms for granular broadcasting
        if (user.permissions) {
            try {
                const perms = typeof user.permissions === 'string'
                    ? JSON.parse(user.permissions)
                    : user.permissions;
                if (Array.isArray(perms)) {
                    perms.forEach((perm) => socket.join(`perm:${perm}`));
                }
            }
            catch { /* invalid permissions, no extra rooms */ }
        }
        // Periodic token re-verification every 5 minutes
        const tokenCheckInterval = setInterval(() => {
            const token = socket.handshake.auth.token;
            if (!token) {
                (0, logger_1.log)('warn', 'Socket token missing during re-verification', { userId: user.userId });
                socket.disconnect(true);
                return;
            }
            try {
                authService.verifyAccessToken(token);
            }
            catch {
                (0, logger_1.log)('info', 'Socket token expired, disconnecting', { userId: user.userId });
                socket.emit('error', { message: 'Token scaduto, riconnessione necessaria' });
                socket.disconnect(true);
            }
        }, 5 * 60 * 1000);
        (0, geolocation_handler_1.setupGeolocation)(io, socket);
        (0, notifications_handler_1.setupNotifications)(io, socket);
        (0, deviceStatus_handler_1.setupDeviceStatus)(io, socket);
        socket.on('disconnect', () => {
            clearInterval(tokenCheckInterval);
            (0, logger_1.log)('info', 'Socket disconnected', { userId: user.userId });
        });
    });
}
//# sourceMappingURL=index.js.map