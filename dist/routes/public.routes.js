"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const connection_1 = require("../db/connection");
const router = (0, express_1.Router)();
// Rate limit: 30 requests/minute per IP
const publicLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});
router.use(publicLimiter);
// GET /api/public/track/:barcode — public shipment tracking
router.get('/track/:barcode', async (req, res) => {
    const barcode = req.params.barcode;
    if (!barcode || barcode.length < 3) {
        res.status(400).json({ error: 'Barcode non valido' });
        return;
    }
    try {
        const spedizione = await (0, connection_1.dbSpedizioni)('spedizioni')
            .where({ barcode })
            .first();
        if (!spedizione) {
            res.status(404).json({ error: 'Spedizione non trovata' });
            return;
        }
        // Get latest esito
        const ultimoEsito = await (0, connection_1.dbTrack)('esiti')
            .where({ barcode })
            .orderBy('data', 'desc')
            .orderBy('id', 'desc')
            .first();
        // Mask recipient name: first letter + ****
        let destinatarioMasked = '****';
        const nome = spedizione.destinatario_nome || spedizione.destinatario_cognome || '';
        if (nome.length > 0) {
            destinatarioMasked = nome.charAt(0).toUpperCase() + '****';
        }
        res.json({
            barcode: spedizione.barcode,
            stato: spedizione.stato || (ultimoEsito ? ultimoEsito.esito : 'in_lavorazione'),
            ultimo_esito: ultimoEsito ? ultimoEsito.esito : null,
            data_ultimo_esito: ultimoEsito ? ultimoEsito.data : null,
            destinatario_nome: destinatarioMasked,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel tracciamento' });
    }
});
exports.default = router;
//# sourceMappingURL=public.routes.js.map