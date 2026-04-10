"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShiftData = getShiftData;
exports.batchSync = batchSync;
exports.getDelta = getDelta;
const sync_service_1 = require("../services/sync.service");
const service = new sync_service_1.SyncService();
async function getShiftData(req, res) {
    try {
        const data = await service.getShiftData(req.user.userId);
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel download dati turno' });
    }
}
async function batchSync(req, res) {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Nessun elemento da sincronizzare' });
        return;
    }
    try {
        const result = await service.processBatchSync(req.user.userId, items);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella sincronizzazione' });
    }
}
async function getDelta(req, res) {
    const since = req.query.since;
    if (!since) {
        res.status(400).json({ error: 'Parametro since obbligatorio' });
        return;
    }
    try {
        const data = await service.getDeltaUpdates(req.user.userId, new Date(since));
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero aggiornamenti' });
    }
}
//# sourceMappingURL=sync.controller.js.map