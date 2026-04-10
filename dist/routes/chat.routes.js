"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const connection_1 = require("../db/connection");
const logger_1 = require("../utils/logger");
const validators_1 = require("../utils/validators");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Ensure chat_messages table exists
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
// GET /chat/messages — get messages for the current user (with a specific user or all supervisors)
router.get('/messages', async (req, res) => {
    try {
        await ensureChatTable();
        const userId = req.user.userId;
        const receiverId = req.query.receiver_id ? parseInt(req.query.receiver_id) : null;
        let query = (0, connection_1.dbTrack)('chat_messages');
        if (receiverId) {
            // Messages between this user and a specific user
            query = query.where(function () {
                this.where({ sender_id: userId, receiver_id: receiverId })
                    .orWhere({ sender_id: receiverId, receiver_id: userId });
            });
        }
        else {
            // All messages involving this user
            query = query.where(function () {
                this.where({ sender_id: userId })
                    .orWhere({ receiver_id: userId });
            });
        }
        // Mark received messages as read
        await (0, connection_1.dbTrack)('chat_messages')
            .where({ receiver_id: userId, read: false })
            .update({ read: true });
        const messages = await query
            .orderBy('timestamp', 'asc')
            .limit(100)
            .select('id', 'sender_id', 'receiver_id', 'message', 'timestamp', 'read');
        res.json(messages);
    }
    catch (err) {
        (0, logger_1.log)('error', 'Chat messages error', { error: err.message });
        res.status(500).json({ error: 'Errore nel recupero messaggi' });
    }
});
// POST /chat/messages — send a message
router.post('/messages', async (req, res) => {
    try {
        await ensureChatTable();
        const userId = req.user.userId;
        const { message, receiver_id } = req.body;
        if (!message) {
            res.status(400).json({ error: 'Messaggio obbligatorio' });
            return;
        }
        const sanitizedMessage = (0, validators_1.sanitizeString)(message);
        // If no receiver_id specified, send to ALL supervisors
        let targetId = receiver_id;
        let allSupervisors = [];
        if (!targetId) {
            allSupervisors = await (0, connection_1.dbTrack)('users')
                .where({ role: 'supervisore', active: true })
                .select('id');
            targetId = allSupervisors[0]?.id;
        }
        if (!targetId) {
            res.status(400).json({ error: 'Nessun destinatario trovato' });
            return;
        }
        // If sending to all supervisors, create a message for each
        const targets = allSupervisors.length > 0 ? allSupervisors.map((s) => s.id) : [targetId];
        let firstMessage = null;
        for (const tid of targets) {
            const [id] = await (0, connection_1.dbTrack)('chat_messages').insert({
                sender_id: userId,
                receiver_id: tid,
                message: sanitizedMessage,
                timestamp: new Date(),
                read: false,
            });
            const msg = {
                id,
                sender_id: userId,
                receiver_id: tid,
                message: sanitizedMessage,
                timestamp: new Date().toISOString(),
                read: false,
            };
            if (!firstMessage)
                firstMessage = msg;
            // Emit via socket.io to each supervisor
            const io = req.app.get('io');
            if (io) {
                io.to(`user:${tid}`).emit('chat:message', msg);
            }
        }
        res.status(201).json(firstMessage);
    }
    catch (err) {
        (0, logger_1.log)('error', 'Chat send error', { error: err.message });
        res.status(500).json({ error: 'Errore nell\'invio messaggio' });
    }
});
exports.default = router;
//# sourceMappingURL=chat.routes.js.map