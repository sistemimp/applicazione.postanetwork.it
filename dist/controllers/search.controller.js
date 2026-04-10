"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchByBarcode = searchByBarcode;
exports.searchFreeText = searchFreeText;
const search_service_1 = require("../services/search.service");
const validators_1 = require("../utils/validators");
const service = new search_service_1.SearchService();
async function searchByBarcode(req, res) {
    const barcode = req.params.barcode;
    try {
        const result = await service.searchByBarcode(barcode);
        if (!result) {
            res.status(404).json({ error: 'Barcode non trovato' });
            return;
        }
        res.json({ result });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella ricerca' });
    }
}
async function searchFreeText(req, res) {
    const query = req.query.q;
    const lat = req.query.lat ? parseFloat(req.query.lat) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng) : undefined;
    if (!query || query.length < 2) {
        res.status(400).json({ error: 'Query troppo corta' });
        return;
    }
    try {
        const results = await service.searchFreeText((0, validators_1.sanitizeString)(query), lat, lng);
        res.json({ results });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella ricerca' });
    }
}
//# sourceMappingURL=search.controller.js.map