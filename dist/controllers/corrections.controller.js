"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOutcome = updateOutcome;
exports.updateRecipient = updateRecipient;
exports.selfCorrect = selfCorrect;
exports.getAuditTrail = getAuditTrail;
const corrections_service_1 = require("../services/corrections.service");
const validators_1 = require("../utils/validators");
const service = new corrections_service_1.CorrectionsService();
async function updateOutcome(req, res) {
    const { id } = req.params;
    const { esito, motivo } = req.body;
    const error = (0, validators_1.validateRequired)({ esito, motivo });
    if (error) {
        res.status(400).json({ error });
        return;
    }
    try {
        await service.updateOutcome(parseInt(id), esito.trim(), req.user.userId, (0, validators_1.sanitizeString)(motivo));
        res.json({ message: 'Esito aggiornato' });
    }
    catch (err) {
        const message = err.message;
        res.status(message === 'Esito non trovato' ? 404 : 500).json({ error: message });
    }
}
async function updateRecipient(req, res) {
    const { id } = req.params;
    const { motivo, ...data } = req.body;
    if (!motivo) {
        res.status(400).json({ error: 'Motivo della correzione obbligatorio' });
        return;
    }
    try {
        await service.updateRecipientData(parseInt(id), data, req.user.userId, (0, validators_1.sanitizeString)(motivo), req.user.role);
        res.json({ message: 'Dati destinatario aggiornati' });
    }
    catch (err) {
        const status = (0, validators_1.getErrorStatusCode)(err);
        res.status(status).json({ error: err.message || 'Errore nell\'aggiornamento' });
    }
}
async function selfCorrect(req, res) {
    const { barcode, esito } = req.body;
    const error = (0, validators_1.validateRequired)({ barcode, esito });
    if (error) {
        res.status(400).json({ error });
        return;
    }
    try {
        await service.selfCorrectByBarcode((0, validators_1.sanitizeBarcode)(barcode), esito.trim(), req.user.userId);
        res.json({ message: 'Esito aggiornato' });
    }
    catch (err) {
        const message = err.message;
        const status = message === 'Esito non trovato' ? 404 : 500;
        res.status(status).json({ error: message });
    }
}
async function getAuditTrail(req, res) {
    const { type, id } = req.params;
    try {
        const trail = await service.getAuditTrail(type, parseInt(id));
        res.json({ audit: trail });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero audit' });
    }
}
//# sourceMappingURL=corrections.controller.js.map