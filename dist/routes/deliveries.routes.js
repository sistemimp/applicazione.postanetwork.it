"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const deliveries_controller_1 = require("../controllers/deliveries.controller");
const connection_1 = require("../db/connection");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// M1: File filter — only allow image/jpeg and image/png for photo uploads
const imageFileFilter = (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Tipo file non consentito: ${file.mimetype}. Solo JPEG e PNG.`));
    }
};
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: imageFileFilter,
});
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('postino', 'supervisore'));
router.get('/today', deliveries_controller_1.getToday);
router.post('/outcome', deliveries_controller_1.registerOutcome);
router.get('/check/:barcode', deliveries_controller_1.checkPrevious);
router.get('/history', deliveries_controller_1.getDailyHistory);
router.get('/dashboard-summary', deliveries_controller_1.getDashboardSummary);
router.get('/optimized-route', deliveries_controller_1.getOptimizedRoute);
router.get('/zone', deliveries_controller_1.getZoneAssignment);
router.get('/piece-counts', deliveries_controller_1.getPieceCounts);
router.get('/search', deliveries_controller_1.searchFreeText);
// GET photo for a barcode
router.get('/photo/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const esito = await (0, connection_1.dbTrack)('esiti')
            .where({ barcode })
            .whereNotNull('foto_base64')
            .orderBy('data', 'desc')
            .orderBy('ora', 'desc')
            .select('foto_base64')
            .first();
        if (!esito || !esito.foto_base64) {
            res.status(404).json({ error: 'Nessuna foto trovata per questo barcode' });
            return;
        }
        res.json({ foto_base64: esito.foto_base64 });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Errore nel recupero foto', { barcode: req.params.barcode, error: err.message });
        res.status(500).json({ error: 'Errore nel recupero della foto' });
    }
});
// POST photo via multipart/form-data — converts to Base64 and saves
router.post('/photo/:barcode', upload.single('photo'), async (req, res) => {
    try {
        const { barcode } = req.params;
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: 'Nessun file inviato' });
            return;
        }
        const mimeType = file.mimetype || 'image/jpeg';
        const base64Data = file.buffer.toString('base64');
        const fotoBase64 = `data:${mimeType};base64,${base64Data}`;
        const updated = await (0, connection_1.dbTrack)('esiti')
            .where({ barcode })
            .orderBy('data', 'desc')
            .orderBy('ora', 'desc')
            .first()
            .then(async (esito) => {
            if (!esito)
                return 0;
            return (0, connection_1.dbTrack)('esiti').where({ id: esito.id }).update({ foto_base64: fotoBase64 });
        });
        if (!updated) {
            res.status(404).json({ error: 'Nessun esito trovato per questo barcode' });
            return;
        }
        res.json({ message: 'Foto salvata', barcode });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Errore nel salvataggio foto', { barcode: req.params.barcode, error: err.message });
        res.status(500).json({ error: 'Errore nel salvataggio della foto' });
    }
});
// Alias: /counts-by-type → same handler as /piece-counts
router.get('/counts-by-type', deliveries_controller_1.getPieceCounts);
// Alias: /timeline/:barcode → timeline for a barcode (proxied from data routes)
router.get('/timeline/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        const esiti = await (0, connection_1.dbTrack)('esiti')
            .where({ barcode })
            .orderBy('data', 'asc')
            .orderBy('ora', 'asc')
            .orderBy('id', 'asc')
            .select('id', 'barcode', 'esito', 'data', 'ora', 'latitudine', 'longitudine', 'postino_id', 'note', 'created_offline', 'synced_at', 'created_at');
        const { dbSpedizioni } = require('../db/connection');
        const spedizione = await dbSpedizioni('spedizioni').where({ barcode }).first();
        if (esiti.length === 0 && !spedizione) {
            res.status(404).json({ error: `Nessun dato trovato per il barcode "${barcode}"` });
            return;
        }
        const postinoIds = [...new Set(esiti.map((e) => e.postino_id))];
        let postiniMap = {};
        if (postinoIds.length > 0) {
            const postini = await (0, connection_1.dbTrack)('users')
                .whereIn('id', postinoIds)
                .select('id', 'username');
            postiniMap = Object.fromEntries(postini.map((p) => [p.id, p.username]));
        }
        res.json({
            barcode,
            spedizione: spedizione || null,
            timeline: esiti.map((e) => ({
                ...e,
                postino_username: postiniMap[e.postino_id] || `Postino #${e.postino_id}`,
            })),
        });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Errore nel recupero timeline', { barcode: req.params.barcode, error: err.message });
        res.status(500).json({ error: 'Errore nel recupero della timeline' });
    }
});
// Alias: /report (GET and POST) → proxy to data report endpoints
router.get('/report', async (req, res) => {
    try {
        const data = req.query.data || new Date().toISOString().split('T')[0];
        const userId = req.user.userId;
        const esiti = await (0, connection_1.dbTrack)('esiti')
            .where({ postino_id: userId })
            .andWhere('data', data)
            .orderBy('ora', 'asc')
            .select('id', 'barcode', 'esito', 'data', 'ora', 'latitudine', 'longitudine', 'postino_id', 'note', 'created_offline', 'synced_at');
        const totale = esiti.length;
        const consegnati = esiti.filter((e) => e.esito === 'consegnato').length;
        const nonConsegnati = totale - consegnati;
        res.json({
            data,
            totale,
            consegnati,
            non_consegnati: nonConsegnati,
            esiti,
        });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Errore nel report', { error: err.message });
        res.status(500).json({ error: 'Errore nella generazione del report' });
    }
});
router.post('/report', async (req, res) => {
    try {
        const data = req.body.data || new Date().toISOString().split('T')[0];
        const userId = req.user.userId;
        const esiti = await (0, connection_1.dbTrack)('esiti')
            .where({ postino_id: userId })
            .andWhere('data', data)
            .orderBy('ora', 'asc')
            .select('id', 'barcode', 'esito', 'data', 'ora', 'latitudine', 'longitudine', 'postino_id', 'note', 'created_offline', 'synced_at');
        const totale = esiti.length;
        const consegnati = esiti.filter((e) => e.esito === 'consegnato').length;
        const nonConsegnati = totale - consegnati;
        res.json({
            data,
            totale,
            consegnati,
            non_consegnati: nonConsegnati,
            esiti,
        });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Errore nel report', { error: err.message });
        res.status(500).json({ error: 'Errore nella generazione del report' });
    }
});
// Giacenze accessibili a TUTTI i postini/supervisori — intenzionale:
// qualsiasi postino può ritentare la consegna di una giacenza
router.get('/giacenze-list', async (req, res) => {
    try {
        // Fix 7: Only show barcodes whose LATEST esito is still "in giacenza"
        // Uses a subquery to get the most recent esito per barcode
        const postinoId = req.user?.userId;
        const giacenze = await connection_1.dbTrack.raw(`
      WITH latest_esiti AS (
        SELECT id, barcode, esito, data, ora, latitudine, longitudine, postino_id, note, created_offline, synced_at, created_at,
          ROW_NUMBER() OVER (PARTITION BY barcode ORDER BY data DESC, ora DESC, id DESC) AS rn
        FROM esiti
      )
      SELECT id, barcode, esito, data, ora, latitudine, longitudine, postino_id, note, created_offline, synced_at, created_at, rn
      FROM latest_esiti
      WHERE rn = 1 AND esito IN ('in giacenza', 'giacenza')
      ${postinoId ? 'AND postino_id = ?' : ''}
      ORDER BY created_at DESC
    `, postinoId ? [postinoId] : []).then((rows) => rows[0] || rows);
        // Enrich with spedizioni data — single batch query instead of N+1
        const barcodes = giacenze.map((g) => g.barcode);
        const spedizioni = barcodes.length > 0
            ? await (0, connection_1.dbSpedizioni)('spedizioni').whereIn('barcode', barcodes).select('barcode', 'destinatario_nome', 'destinatario_cognome', 'indirizzo', 'civico', 'comune')
            : [];
        const spedMap = new Map(spedizioni.map((s) => [s.barcode, s]));
        const enriched = giacenze.map((g) => {
            const sped = spedMap.get(g.barcode);
            const { rn, ...rest } = g; // rimuovi colonna interna rn dalla risposta
            return {
                ...rest,
                destinatario_nome: sped?.destinatario_nome || '',
                destinatario_cognome: sped?.destinatario_cognome || '',
                indirizzo: sped?.indirizzo || '',
                civico: sped?.civico || '',
                comune: sped?.comune || '',
            };
        });
        res.json({ giacenze: enriched });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Errore nel caricamento giacenze', { error: err.message });
        res.status(500).json({ error: 'Errore nel caricamento giacenze' });
    }
});
exports.default = router;
//# sourceMappingURL=deliveries.routes.js.map