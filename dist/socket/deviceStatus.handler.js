"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceHeartbeats = void 0;
exports.setupDeviceStatus = setupDeviceStatus;
const logger_1 = require("../utils/logger");
const index_1 = require("./index");
// In-memory store keyed by userId
exports.deviceHeartbeats = new Map();
function setupDeviceStatus(io, socket) {
    const user = socket.data.user;
    socket.on('device:heartbeat', (data) => {
        try {
            // Rate limit: max 120 heartbeats/minute
            if (!(0, index_1.checkSocketRateLimit)(user.userId, 'heartbeat')) {
                (0, logger_1.log)('warn', 'Heartbeat rate limit exceeded', { userId: user.userId });
                socket.emit('error', { message: 'Troppi heartbeat inviati. Riprova tra un minuto.' });
                socket.disconnect(true);
                return;
            }
            exports.deviceHeartbeats.set(user.userId, {
                battery_level: data.battery_level,
                battery_charging: data.battery_charging,
                connection_type: data.connection_type,
                lastSeen: data.timestamp || new Date().toISOString(),
                username: user.username,
                userId: user.userId,
            });
            // Notify supervisors of status update
            io.to('role:supervisore').emit('device:status_update', {
                userId: user.userId,
                username: user.username,
                ...data,
            });
        }
        catch (err) {
            (0, logger_1.log)('error', 'Device heartbeat error', { userId: user.userId, error: err.message });
        }
    });
    socket.on('disconnect', () => {
        // Don't remove — keep last known state so admin can see "last seen"
    });
}
//# sourceMappingURL=deviceStatus.handler.js.map