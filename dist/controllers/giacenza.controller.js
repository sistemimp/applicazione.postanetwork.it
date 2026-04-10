"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToGiacenza = addToGiacenza;
exports.findByBarcode = findByBarcode;
exports.markRetrieved = markRetrieved;
const giacenza_service_1 = require("../services/giacenza.service");
const validators_1 = require("../utils/validators");
const connection_1 = require("../db/connection");
const service = new giacenza_service_1.GiacenzaService();
async function addToGiacenza(req, res) {
    const { barcode, scaffale, contenitore, numero_posizione } = req.body;
    const error = (0, validators_1.validateRequired)({ barcode, scaffale, numero_posizione });
    if (error) {
        res.status(400).json({ error });
        return;
    }
    try {
        const id = await service.addToGiacenza({
            barcode: (0, validators_1.sanitizeBarcode)(barcode),
            scaffale: (0, validators_1.sanitizeString)(scaffale),
            contenitore: contenitore ? (0, validators_1.sanitizeString)(contenitore) : '',
            numero_posizione: (0, validators_1.sanitizeString)(numero_posizione),
        });
        res.status(201).json({ id, message: 'Aggiunto in giacenza' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'inserimento giacenza' });
    }
}
async function findByBarcode(req, res) {
    try {
        const barcode = req.params.barcode;
        // Postino can only see giacenza for barcodes assigned to them
        if (req.user.role === 'postino') {
            const spedizione = await (0, connection_1.dbSpedizioni)('spedizioni')
                .where({ barcode, postino_id: req.user.userId })
                .first();
            if (!spedizione) {
                res.status(403).json({ error: 'Non autorizzato a visualizzare questa giacenza' });
                return;
            }
        }
        const result = await service.findByBarcode(barcode);
        if (!result) {
            res.status(404).json({ error: 'Non trovato in giacenza' });
            return;
        }
        res.json({ giacenza: result });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella ricerca' });
    }
}
async function markRetrieved(req, res) {
    const barcode = req.params.barcode;
    try {
        await service.markAsRetrieved(barcode, req.user.userId);
        res.json({ message: 'Giacenza ritirata' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'aggiornamento' });
    }
}
//# sourceMappingURL=giacenza.controller.js.map