"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupNotifications = setupNotifications;
exports.sendNotification = sendNotification;
exports.sendToRole = sendToRole;
function setupNotifications(_io, _socket) {
    // Server-initiated notifications — no client event handlers needed
}
function sendNotification(io, userId, type, data) {
    io.to(`user:${userId}`).emit('notification', { type, data, timestamp: new Date().toISOString() });
}
function sendToRole(io, role, type, data) {
    io.to(`role:${role}`).emit('notification', { type, data, timestamp: new Date().toISOString() });
}
//# sourceMappingURL=notifications.handler.js.map