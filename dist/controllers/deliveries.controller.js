"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToday = getToday;
exports.registerOutcome = registerOutcome;
exports.checkPrevious = checkPrevious;
exports.getOptimizedRoute = getOptimizedRoute;
exports.getZoneAssignment = getZoneAssignment;
exports.getPieceCounts = getPieceCounts;
exports.searchFreeText = searchFreeText;
exports.getDashboardSummary = getDashboardSummary;
exports.getDailyHistory = getDailyHistory;
const deliveries_service_1 = require("../services/deliveries.service");
const validators_1 = require("../utils/validators");
const service = new deliveries_service_1.DeliveriesService();
async function getToday(req, res) {
    try {
        const deliveries = await service.getToday(req.user.userId);
        res.json({ deliveries });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero consegne' });
    }
}
async function registerOutcome(req, res) {
    const { barcode, esito, data, ora, latitudine, longitudine, note, firma_path, foto_base64, firma_base64, reso_motivo, created_offline } = req.body;
    const error = (0, validators_1.validateRequired)({ barcode, esito });
    if (error) {
        res.status(400).json({ error });
        return;
    }
    try {
        const id = await service.registerOutcome({
            barcode: (0, validators_1.sanitizeBarcode)(barcode),
            esito: esito.trim(),
            data: data || undefined,
            ora: ora || undefined,
            latitudine,
            longitudine,
            postino_id: req.user.userId,
            note: note ? (0, validators_1.sanitizeString)(note) : undefined,
            firma_path: firma_path || undefined,
            foto_base64: foto_base64 || undefined,
            firma_base64: firma_base64 || undefined,
            reso_motivo: reso_motivo ? (0, validators_1.sanitizeString)(reso_motivo) : undefined,
            created_offline,
        });
        res.status(201).json({ id, message: 'Esito registrato' });
    }
    catch (err) {
        const status = (0, validators_1.getErrorStatusCode)(err);
        res.status(status).json({ error: err.message || 'Errore nella registrazione esito' });
    }
}
async function checkPrevious(req, res) {
    const { barcode } = req.params;
    try {
        const previous = await service.checkPreviousOutcome(barcode);
        res.json({ exists: !!previous, outcome: previous });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella verifica' });
    }
}
async function getOptimizedRoute(req, res) {
    try {
        const lat = parseFloat(req.query.lat) || 0;
        const lng = parseFloat(req.query.lng) || 0;
        const deliveries = await service.getOptimizedRoute(req.user.userId, lat, lng);
        res.json({ route: deliveries });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel calcolo percorso' });
    }
}
async function getZoneAssignment(req, res) {
    try {
        const zone = await service.getZoneAssignment(req.user.userId);
        res.json(zone);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero zona' });
    }
}
async function getPieceCounts(req, res) {
    try {
        const counts = await service.getPieceCounts(req.user.userId);
        res.json({ counts });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel conteggio pezzi' });
    }
}
async function searchFreeText(req, res) {
    try {
        const q = req.query.q || '';
        const lat = parseFloat(req.query.lat) || 0;
        const lng = parseFloat(req.query.lng) || 0;
        const results = await service.searchFreeText(q, lat, lng, req.user.userId);
        res.json(results);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella ricerca' });
    }
}
async function getDashboardSummary(req, res) {
    try {
        const userId = req.user.userId;
        const [history, zone, pieceCounts] = await Promise.all([
            service.getDailyHistory(userId),
            service.getZoneAssignment(userId),
            service.getPieceCounts(userId),
        ]);
        res.json({ history, zone, pieceCounts });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero dati dashboard' });
    }
}
async function getDailyHistory(req, res) {
    try {
        // Fix 8: Accept optional ?date=YYYY-MM-DD parameter
        const date = req.query.date;
        const history = await service.getDailyHistory(req.user.userId, date);
        res.json({ history });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero cronologia' });
    }
}
//# sourceMappingURL=deliveries.controller.js.map