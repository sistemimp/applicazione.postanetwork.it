"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupChat = setupChat;
const connection_1 = require("../db/connection");
const logger_1 = require("../utils/logger");
const index_1 = require("./index");
const validators_1 = require("../utils/validators");
async function ensureChatTable() {
    const exists = await connection_1.dbTrack.schema.hasTable('chat_messages');
    if (!exists) {
        await connection_1.dbTrack.schema.createTable('chat_messages', (table) => {
            table.increments('id').primary();
            table.integer('sender_id').unsigned().notNullable();
            table.integer('receiver_id').unsigned().notNullable();
            table.text('message').notNullable();
            table.timestamp('timestamp').defaultTo(connection_1.dbTrack.fn.now());
            table.boolean('read').defaultTo(false);
            table.index(['sender_id', 'receiver_id']);
            table.index(['timestamp']);
        });
    }
}
function setupChat(io, socket) {
    const user = socket.data.user;
    // Handle chat message from postino to admin (or admin to postino)
    socket.on('chat:message', async (data) => {
        try {
            // Rate limit: max 60 messages/minute
            if (!(0, index_1.checkSocketRateLimit)(user.userId, 'chat')) {
                (0, logger_1.log)('warn', 'Chat rate limit exceeded', { userId: user.userId });
                socket.emit('chat:error', { error: 'Troppi messaggi inviati. Riprova tra un minuto.' });
                socket.disconnect(true);
                return;
            }
            await ensureChatTable();
            const { receiver_id, message } = data;
            if (!receiver_id || !message)
                return;
            const sanitizedMessage = (0, validators_1.sanitizeString)(message);
            const [id] = await (0, connection_1.dbTrack)('chat_messages').insert({
                sender_id: user.userId,
                receiver_id,
                message: sanitizedMessage,
                timestamp: new Date(),
                read: false,
            });
            const newMessage = {
                id,
                sender_id: user.userId,
                receiver_id,
                message: sanitizedMessage,
                timestamp: new Date().toISOString(),
                read: false,
            };
            // Send to receiver
            io.to(`user:${receiver_id}`).emit('chat:message', newMessage);
            // Send back to sender for confirmation
            socket.emit('chat:message', newMessage);
            (0, logger_1.log)('info', 'Chat message sent via socket', { from: user.userId, to: receiver_id });
        }
        catch (err) {
            (0, logger_1.log)('error', 'Chat socket error', { error: err.message });
            socket.emit('chat:error', { error: 'Errore nell\'invio messaggio' });
        }
    });
    // Handle request for chat history
    socket.on('chat:history', async (data) => {
        try {
            await ensureChatTable();
            const { other_user_id } = data;
            if (!other_user_id)
                return;
            const messages = await (0, connection_1.dbTrack)('chat_messages')
                .where(function () {
                this.where({ sender_id: user.userId, receiver_id: other_user_id })
                    .orWhere({ sender_id: other_user_id, receiver_id: user.userId });
            })
                .orderBy('timestamp', 'desc')
                .limit(200)
                .select('id', 'sender_id', 'receiver_id', 'message', 'timestamp', 'read');
            messages.reverse();
            socket.emit('chat:history', { messages, other_user_id });
        }
        catch (err) {
            (0, logger_1.log)('error', 'Chat history error', { error: err.message });
        }
    });
    // Mark messages as read
    socket.on('chat:read', async (data) => {
        try {
            await ensureChatTable();
            await (0, connection_1.dbTrack)('chat_messages')
                .where({ sender_id: data.sender_id, receiver_id: user.userId, read: false })
                .update({ read: true });
        }
        catch (err) {
            (0, logger_1.log)('error', 'Chat read error', { error: err.message });
        }
    });
}
//# sourceMappingURL=chat.handler.js.map