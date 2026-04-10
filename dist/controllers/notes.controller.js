"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
exports.getByBarcode = getByBarcode;
exports.search = search;
exports.checkExisting = checkExisting;
const notes_service_1 = require("../services/notes.service");
const validators_1 = require("../utils/validators");
const service = new notes_service_1.NotesService();
async function create(req, res) {
    const { barcode, nome, cognome, indirizzo_originale, nota, categoria } = req.body;
    const error = (0, validators_1.validateRequired)({ barcode, nome, cognome, nota });
    if (error) {
        res.status(400).json({ error });
        return;
    }
    try {
        const id = await service.create({
            barcode: (0, validators_1.sanitizeBarcode)(barcode),
            data: new Date(),
            nome: (0, validators_1.sanitizeString)(nome),
            cognome: (0, validators_1.sanitizeString)(cognome),
            indirizzo_originale: indirizzo_originale ? (0, validators_1.sanitizeString)(indirizzo_originale) : '',
            civico_originale: req.body.civico_originale || '',
            subcivico_originale: req.body.subcivico_originale || '',
            indirizzo_corretto: req.body.indirizzo_corretto ? (0, validators_1.sanitizeString)(req.body.indirizzo_corretto) : null,
            civico_corretto: req.body.civico_corretto || null,
            subcivico_corretto: req.body.subcivico_corretto || null,
            nota: (0, validators_1.sanitizeString)(nota),
            categoria: categoria || 'Altro',
            foto_path: null,
            latitudine: req.body.latitudine || null,
            longitudine: req.body.longitudine || null,
            postino_id: req.user.userId,
        });
        res.status(201).json({ id, message: 'Nota creata' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella creazione nota' });
    }
}
async function getByBarcode(req, res) {
    try {
        const notes = await service.getByBarcode(req.params.barcode);
        res.json({ notes });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero note' });
    }
}
async function search(req, res) {
    const query = req.query.q;
    if (!query || query.length < 2) {
        res.status(400).json({ error: 'Query troppo corta (minimo 2 caratteri)' });
        return;
    }
    try {
        const notes = await service.searchByNameOrAddress((0, validators_1.sanitizeString)(query));
        res.json({ notes });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella ricerca' });
    }
}
async function checkExisting(req, res) {
    try {
        const exists = await service.checkExisting(req.params.barcode);
        res.json({ exists });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella verifica' });
    }
}
//# sourceMappingURL=notes.controller.js.map