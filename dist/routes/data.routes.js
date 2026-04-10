"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const apiKeyAuth_1 = require("../middleware/apiKeyAuth");
const connection_1 = require("../db/connection");
const deviceStatus_handler_1 = require("../socket/deviceStatus.handler");
const validators_1 = require("../utils/validators");
const pdfkit_1 = __importDefault(require("pdfkit"));
const url_1 = require("url");
const router = (0, express_1.Router)();
// SC4: SSRF protection — validate webhook URLs
function validateWebhookUrl(urlStr) {
    let parsed;
    try {
        parsed = new url_1.URL(urlStr);
    }
    catch {
        return 'URL non valido';
    }
    // Require HTTPS
    if (parsed.protocol !== 'https:') {
        return 'Solo URL HTTPS sono consentiti per i webhook';
    }
    // Reject localhost and loopback
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')) {
        return 'URL localhost/loopback non consentiti';
    }
    // Reject private/internal IP ranges
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
        const [, a, b, c] = ipMatch.map(Number);
        if (a === 10 || // 10.0.0.0/8
            (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
            (a === 192 && b === 168) || // 192.168.0.0/16
            a === 127 || // 127.0.0.0/8
            (a === 169 && b === 254) || // 169.254.0.0/16 (link-local)
            a === 0 // 0.0.0.0/8
        ) {
            return 'URL con IP privati/interni non consentiti';
        }
    }
    return null;
}
// Combined auth: accepts both JWT (supervisore) and API Key
router.use(apiKeyAuth_1.combinedAuth);
// For JWT users, check supervisore role; for API key users, skip role check
router.use((req, res, next) => {
    if (req.user && req.user.role === 'api') {
        // API key user — skip role authorization, go to permission check
        next();
    }
    else {
        // JWT user — require supervisore role
        (0, auth_1.authorize)('supervisore')(req, res, next);
    }
});
// For API key users, check read/write/all permissions based on HTTP method
router.use(apiKeyAuth_1.checkApiKeyPermission);
// ════════════════════════════════════════════════════
// In-memory API usage counter
// ════════════════════════════════════════════════════
const apiUsageCounters = {};
function trackApiUsage(endpoint) {
    const today = new Date().toISOString().substring(0, 10);
    if (!apiUsageCounters[today])
        apiUsageCounters[today] = {};
    apiUsageCounters[today][endpoint] = (apiUsageCounters[today][endpoint] || 0) + 1;
}
// ════════════════════════════════════════════════════
// Ensure tables exist (webhooks, notifications_log)
// ════════════════════════════════════════════════════
async function ensureWebhooksTable() {
    const exists = await connection_1.dbTrack.schema.hasTable('webhooks');
    if (!exists) {
        await connection_1.dbTrack.schema.createTable('webhooks', (table) => {
            table.increments('id').primary();
            table.string('url', 500).notNullable();
            table.string('barcode', 100).notNullable();
            table.string('event', 50).notNullable().defaultTo('status_change');
            table.boolean('active').defaultTo(true);
            table.timestamp('created_at').defaultTo(connection_1.dbTrack.fn.now());
            table.index(['barcode', 'active']);
        });
    }
}
async function ensureNotificationsLogTable() {
    const exists = await connection_1.dbTrack.schema.hasTable('notifications_log');
    if (!exists) {
        await connection_1.dbTrack.schema.createTable('notifications_log', (table) => {
            table.increments('id').primary();
            table.string('tipo', 20).notNullable(); // 'sms' | 'email'
            table.string('destinatario', 255).notNullable();
            table.string('oggetto', 500).nullable();
            table.text('messaggio').notNullable();
            table.string('stato', 20).defaultTo('inviato');
            table.timestamp('created_at').defaultTo(connection_1.dbTrack.fn.now());
        });
    }
}
// Run table creation on module load
ensureWebhooksTable().catch(() => { });
ensureNotificationsLogTable().catch(() => { });
// ════════════════════════════════════════════════════
// Helper: fire webhooks for a barcode
// ════════════════════════════════════════════════════
async function fireWebhooksForBarcode(barcode, payload) {
    const webhooks = await (0, connection_1.dbTrack)('webhooks')
        .where({ barcode, active: true, event: 'status_change' });
    let fired = 0;
    const errors = [];
    for (const wh of webhooks) {
        try {
            await fetch(wh.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode, ...payload, webhook_id: wh.id }),
                signal: AbortSignal.timeout(10000),
            });
            fired++;
        }
        catch (err) {
            errors.push(`Webhook #${wh.id} fallito: ${err.message}`);
        }
    }
    return { fired, errors };
}
// ════════════════════════════════════════════════════
// Helper: haversine distance in km
// ════════════════════════════════════════════════════
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// ════════════════════════════════════════════════════
// Helper: generate report data for a date range
// ════════════════════════════════════════════════════
async function generateReportData(dateFrom, dateTo) {
    // Total spedizioni in range
    const [totalSped] = await (0, connection_1.dbSpedizioni)('spedizioni')
        .count('* as total')
        .where('data_assegnazione', '>=', dateFrom)
        .where('data_assegnazione', '<=', dateTo);
    // Esiti breakdown
    const esitiByType = await (0, connection_1.dbTrack)('esiti')
        .select('esito')
        .count('* as count')
        .where('data', '>=', dateFrom)
        .where('data', '<=', dateTo)
        .groupBy('esito');
    // Per postino
    const esitiPerPostino = await (0, connection_1.dbTrack)('esiti')
        .select('postino_id')
        .count('* as count')
        .where('data', '>=', dateFrom)
        .where('data', '<=', dateTo)
        .groupBy('postino_id');
    // Get postino usernames
    const postinoIds = esitiPerPostino.map((e) => e.postino_id);
    let postiniMap = {};
    if (postinoIds.length > 0) {
        const postini = await (0, connection_1.dbTrack)('users')
            .whereIn('id', postinoIds)
            .select('id', 'username');
        postiniMap = Object.fromEntries(postini.map((p) => [p.id, p.username]));
    }
    // Per zona (CAP/comune)
    const esitiPerZona = await (0, connection_1.dbSpedizioni)('spedizioni')
        .select('comune', 'cap')
        .count('* as count')
        .where('data_assegnazione', '>=', dateFrom)
        .where('data_assegnazione', '<=', dateTo)
        .groupBy('comune', 'cap')
        .orderBy('count', 'desc')
        .limit(50);
    return {
        periodo: { da: dateFrom, a: dateTo },
        total_spedizioni: totalSped.total || 0,
        esiti_breakdown: esitiByType,
        per_postino: esitiPerPostino.map((e) => ({
            postino_id: e.postino_id,
            username: postiniMap[e.postino_id] || `Postino #${e.postino_id}`,
            count: e.count,
        })),
        per_zona: esitiPerZona,
    };
}
// ════════════════════════════════════════════════════
// EXISTING: GET /spedizioni — list spedizioni with filters
// ════════════════════════════════════════════════════
router.get('/spedizioni', async (req, res) => {
    try {
        trackApiUsage('GET /spedizioni');
        const { barcode, stato, postino, date_from, date_to, page = '1', limit = '50' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        let query = (0, connection_1.dbSpedizioni)('spedizioni').select('*');
        let countQuery = (0, connection_1.dbSpedizioni)('spedizioni').count('* as total');
        if (barcode) {
            const safeBarcode = (0, validators_1.escapeLikeWildcards)(barcode);
            query = query.where('barcode', 'like', `%${safeBarcode}%`);
            countQuery = countQuery.where('barcode', 'like', `%${safeBarcode}%`);
        }
        if (stato) {
            query = query.where('stato', stato);
            countQuery = countQuery.where('stato', stato);
        }
        if (postino) {
            query = query.where('postino_id', parseInt(postino, 10));
            countQuery = countQuery.where('postino_id', parseInt(postino, 10));
        }
        if (date_from) {
            query = query.where('data_assegnazione', '>=', date_from);
            countQuery = countQuery.where('data_assegnazione', '>=', date_from);
        }
        if (date_to) {
            query = query.where('data_assegnazione', '<=', date_to);
            countQuery = countQuery.where('data_assegnazione', '<=', date_to);
        }
        const [totalResult] = await countQuery;
        const total = totalResult.total || 0;
        const spedizioni = await query.orderBy('id', 'desc').limit(limitNum).offset(offset);
        res.json({
            spedizioni,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero spedizioni' });
    }
});
// ════════════════════════════════════════════════════
// EXISTING: GET /esiti — list esiti with filters
// ════════════════════════════════════════════════════
router.get('/esiti', async (req, res) => {
    try {
        trackApiUsage('GET /esiti');
        const { barcode, postino, esito, date_from, date_to, page = '1', limit = '50' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        let query = (0, connection_1.dbTrack)('esiti').select('*');
        let countQuery = (0, connection_1.dbTrack)('esiti').count('* as total');
        if (barcode) {
            const safeBarcode = (0, validators_1.escapeLikeWildcards)(barcode);
            query = query.where('barcode', 'like', `%${safeBarcode}%`);
            countQuery = countQuery.where('barcode', 'like', `%${safeBarcode}%`);
        }
        if (postino) {
            query = query.where('postino_id', parseInt(postino, 10));
            countQuery = countQuery.where('postino_id', parseInt(postino, 10));
        }
        if (esito) {
            query = query.where('esito', esito);
            countQuery = countQuery.where('esito', esito);
        }
        if (date_from) {
            query = query.where('data', '>=', date_from);
            countQuery = countQuery.where('data', '>=', date_from);
        }
        if (date_to) {
            query = query.where('data', '<=', date_to);
            countQuery = countQuery.where('data', '<=', date_to);
        }
        const [totalResult] = await countQuery;
        const total = totalResult.total || 0;
        const esiti = await query.orderBy('data', 'desc').orderBy('id', 'desc').limit(limitNum).offset(offset);
        res.json({
            esiti,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero esiti' });
    }
});
// ════════════════════════════════════════════════════
// EXISTING: GET /stats — aggregate statistics
// ════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
    try {
        trackApiUsage('GET /stats');
        const { date_from, date_to } = req.query;
        // Total spedizioni
        let spedQuery = (0, connection_1.dbSpedizioni)('spedizioni').count('* as total');
        if (date_from)
            spedQuery = spedQuery.where('data_assegnazione', '>=', date_from);
        if (date_to)
            spedQuery = spedQuery.where('data_assegnazione', '<=', date_to);
        const [totalSped] = await spedQuery;
        // Esiti by type
        let esitiQuery = (0, connection_1.dbTrack)('esiti').select('esito').count('* as count').groupBy('esito');
        if (date_from)
            esitiQuery = esitiQuery.where('data', '>=', date_from);
        if (date_to)
            esitiQuery = esitiQuery.where('data', '<=', date_to);
        const esitiByType = await esitiQuery;
        // Esiti by postino
        let esitiPostinoQuery = (0, connection_1.dbTrack)('esiti')
            .select('postino_id')
            .count('* as count')
            .groupBy('postino_id');
        if (date_from)
            esitiPostinoQuery = esitiPostinoQuery.where('data', '>=', date_from);
        if (date_to)
            esitiPostinoQuery = esitiPostinoQuery.where('data', '<=', date_to);
        const esitiByPostino = await esitiPostinoQuery;
        // Esiti by date (last 30 days)
        let esitiDateQuery = (0, connection_1.dbTrack)('esiti')
            .select(connection_1.dbTrack.raw('DATE(data) as date'))
            .count('* as count')
            .groupBy(connection_1.dbTrack.raw('DATE(data)'))
            .orderBy('date', 'desc')
            .limit(30);
        if (date_from)
            esitiDateQuery = esitiDateQuery.where('data', '>=', date_from);
        if (date_to)
            esitiDateQuery = esitiDateQuery.where('data', '<=', date_to);
        const esitiByDate = await esitiDateQuery;
        // Get postino usernames
        const postinoIds = esitiByPostino.map((e) => e.postino_id);
        let postiniMap = {};
        if (postinoIds.length > 0) {
            const postini = await (0, connection_1.dbTrack)('users')
                .whereIn('id', postinoIds)
                .select('id', 'username');
            postiniMap = Object.fromEntries(postini.map((p) => [p.id, p.username]));
        }
        res.json({
            total_spedizioni: totalSped.total || 0,
            esiti_by_type: esitiByType,
            esiti_by_postino: esitiByPostino.map((e) => ({
                ...e,
                username: postiniMap[e.postino_id] || `Postino #${e.postino_id}`,
            })),
            esiti_by_date: esitiByDate,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero statistiche' });
    }
});
// ════════════════════════════════════════════════════════════════
// 1. GESTIONE SPEDIZIONI
// ════════════════════════════════════════════════════════════════
// POST /spedizioni/create — create single shipment
router.post('/spedizioni/create', async (req, res) => {
    try {
        trackApiUsage('POST /spedizioni/create');
        const { barcode, destinatario_nome, destinatario_cognome, indirizzo, civico, cap, comune, provincia, tipo_posta, postino_id } = req.body;
        if (!barcode || !destinatario_nome || !destinatario_cognome || !indirizzo || !cap || !comune || !provincia) {
            res.status(400).json({ error: 'Campi obbligatori mancanti: barcode, destinatario_nome, destinatario_cognome, indirizzo, cap, comune, provincia' });
            return;
        }
        // Check barcode uniqueness
        const existing = await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).first();
        if (existing) {
            res.status(409).json({ error: `Il barcode "${barcode}" esiste già nel sistema` });
            return;
        }
        const [id] = await (0, connection_1.dbSpedizioni)('spedizioni').insert({
            barcode,
            destinatario_nome,
            destinatario_cognome,
            indirizzo,
            civico: civico || null,
            cap,
            comune,
            provincia,
            tipo_posta: tipo_posta || null,
            postino_id: postino_id || null,
            stato: 'da_consegnare',
            data_assegnazione: new Date().toISOString().substring(0, 10),
        });
        res.status(201).json({ message: 'Spedizione creata con successo', id, barcode });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella creazione della spedizione' });
    }
});
// POST /spedizioni/bulk-create — create N shipments from array
router.post('/spedizioni/bulk-create', async (req, res) => {
    try {
        trackApiUsage('POST /spedizioni/bulk-create');
        const { spedizioni } = req.body;
        if (!Array.isArray(spedizioni) || spedizioni.length === 0) {
            res.status(400).json({ error: 'Il campo "spedizioni" deve essere un array non vuoto' });
            return;
        }
        // Check for duplicate barcodes already in DB
        const allBarcodes = spedizioni.map((s) => s.barcode).filter(Boolean);
        const existingRows = await (0, connection_1.dbSpedizioni)('spedizioni')
            .whereIn('barcode', allBarcodes)
            .select('barcode');
        const existingSet = new Set(existingRows.map((r) => r.barcode));
        const toInsert = [];
        const duplicates = [];
        for (const s of spedizioni) {
            if (!s.barcode || existingSet.has(s.barcode)) {
                if (s.barcode)
                    duplicates.push(s.barcode);
                continue;
            }
            // Also skip in-batch duplicates
            if (toInsert.some((i) => i.barcode === s.barcode)) {
                duplicates.push(s.barcode);
                continue;
            }
            toInsert.push({
                barcode: s.barcode,
                destinatario_nome: s.destinatario_nome || '',
                destinatario_cognome: s.destinatario_cognome || '',
                indirizzo: s.indirizzo || '',
                civico: s.civico || null,
                cap: s.cap || '',
                comune: s.comune || '',
                provincia: s.provincia || '',
                tipo_posta: s.tipo_posta || null,
                postino_id: s.postino_id || null,
                stato: 'da_consegnare',
                data_assegnazione: new Date().toISOString().substring(0, 10),
            });
        }
        // Insert in chunks of 500
        let created = 0;
        const CHUNK_SIZE = 500;
        for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
            const chunk = toInsert.slice(i, i + CHUNK_SIZE);
            await (0, connection_1.dbSpedizioni)('spedizioni').insert(chunk);
            created += chunk.length;
        }
        res.status(201).json({
            message: `Inserimento completato`,
            created,
            duplicates_skipped: duplicates.length,
            duplicate_barcodes: duplicates,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'inserimento massivo delle spedizioni' });
    }
});
// PUT /spedizioni/:barcode — update shipment fields
const SPEDIZIONI_ALLOWED_FIELDS = [
    'destinatario_nome', 'destinatario_cognome', 'indirizzo', 'civico',
    'cap', 'comune', 'provincia', 'telefono', 'email', 'note',
    'tipo_posta', 'stato', 'postino_id', 'data_assegnazione',
];
router.put('/spedizioni/:barcode', async (req, res) => {
    try {
        trackApiUsage('PUT /spedizioni/:barcode');
        const { barcode } = req.params;
        // Whitelist: only allow known safe fields
        const updateData = {};
        for (const key of SPEDIZIONI_ALLOWED_FIELDS) {
            if (req.body[key] !== undefined) {
                updateData[key] = req.body[key];
            }
        }
        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ error: 'Nessun campo da aggiornare fornito' });
            return;
        }
        const existing = await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).first();
        if (!existing) {
            res.status(404).json({ error: `Spedizione con barcode "${barcode}" non trovata` });
            return;
        }
        await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).update(updateData);
        res.json({ message: 'Spedizione aggiornata con successo', barcode });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'aggiornamento della spedizione' });
    }
});
// DELETE /spedizioni/:barcode — delete shipment (only if stato != consegnata)
router.delete('/spedizioni/:barcode', async (req, res) => {
    try {
        trackApiUsage('DELETE /spedizioni/:barcode');
        const { barcode } = req.params;
        const existing = await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).first();
        if (!existing) {
            res.status(404).json({ error: `Spedizione con barcode "${barcode}" non trovata` });
            return;
        }
        if (existing.stato === 'consegnata') {
            res.status(403).json({ error: 'Impossibile eliminare una spedizione già consegnata' });
            return;
        }
        await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).del();
        res.json({ message: 'Spedizione eliminata con successo', barcode });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'eliminazione della spedizione' });
    }
});
// POST /spedizioni/assign — assign shipment to postino
router.post('/spedizioni/assign', async (req, res) => {
    try {
        trackApiUsage('POST /spedizioni/assign');
        const { barcode, postino_id } = req.body;
        if (!barcode || !postino_id) {
            res.status(400).json({ error: 'Campi obbligatori: barcode, postino_id' });
            return;
        }
        const existing = await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).first();
        if (!existing) {
            res.status(404).json({ error: `Spedizione con barcode "${barcode}" non trovata` });
            return;
        }
        // Verify postino exists
        const postino = await (0, connection_1.dbTrack)('users').where({ id: postino_id, role: 'postino' }).first();
        if (!postino) {
            res.status(404).json({ error: `Postino con id ${postino_id} non trovato` });
            return;
        }
        await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).update({
            postino_id,
            stato: 'assegnata',
            data_assegnazione: new Date().toISOString().substring(0, 10),
        });
        res.json({ message: 'Spedizione assegnata con successo', barcode, postino_id, postino_username: postino.username });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'assegnazione della spedizione' });
    }
});
// ════════════════════════════════════════════════════════════════
// 2. TRACKING AVANZATO
// ════════════════════════════════════════════════════════════════
// GET /track/:barcode/timeline — full timeline of a package
router.get('/track/:barcode/timeline', async (req, res) => {
    try {
        trackApiUsage('GET /track/:barcode/timeline');
        const { barcode } = req.params;
        const esiti = await (0, connection_1.dbTrack)('esiti')
            .where({ barcode })
            .orderBy('data', 'asc')
            .orderBy('ora', 'asc')
            .orderBy('id', 'asc');
        // Get spedizione info
        const spedizione = await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).first();
        if (esiti.length === 0 && !spedizione) {
            res.status(404).json({ error: `Nessun dato trovato per il barcode "${barcode}"` });
            return;
        }
        // Get postino usernames
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
        res.status(500).json({ error: 'Errore nel recupero della timeline' });
    }
});
// GET /track/bulk — status of multiple barcodes
router.get('/track/bulk', async (req, res) => {
    try {
        trackApiUsage('GET /track/bulk');
        const barcodesParam = req.query.barcodes;
        if (!barcodesParam) {
            res.status(400).json({ error: 'Parametro "barcodes" obbligatorio (separati da virgola)' });
            return;
        }
        const barcodes = barcodesParam.split(',').map((b) => b.trim()).filter(Boolean);
        if (barcodes.length === 0) {
            res.status(400).json({ error: 'Nessun barcode valido fornito' });
            return;
        }
        // Get latest esito for each barcode
        const latestEsiti = await (0, connection_1.dbTrack)('esiti')
            .whereIn('barcode', barcodes)
            .whereIn('id', function () {
            this.select(connection_1.dbTrack.raw('MAX(id)'))
                .from('esiti')
                .whereIn('barcode', barcodes)
                .groupBy('barcode');
        });
        // Get spedizioni info
        const spedizioni = await (0, connection_1.dbSpedizioni)('spedizioni')
            .whereIn('barcode', barcodes);
        const spedMap = {};
        for (const s of spedizioni)
            spedMap[s.barcode] = s;
        const esitoMap = {};
        for (const e of latestEsiti)
            esitoMap[e.barcode] = e;
        const result = barcodes.map((b) => ({
            barcode: b,
            stato_spedizione: spedMap[b]?.stato || null,
            ultimo_esito: esitoMap[b] || null,
            trovato: !!(spedMap[b] || esitoMap[b]),
        }));
        res.json({ barcodes: result });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero dello stato dei barcodes' });
    }
});
// POST /webhook/register — Register webhook
router.post('/webhook/register', async (req, res) => {
    try {
        trackApiUsage('POST /webhook/register');
        const { url, barcode, event } = req.body;
        if (!url || !barcode) {
            res.status(400).json({ error: 'Campi obbligatori: url, barcode' });
            return;
        }
        // SC4: SSRF protection — validate webhook URL
        const webhookUrlError = validateWebhookUrl(url);
        if (webhookUrlError) {
            res.status(400).json({ error: webhookUrlError });
            return;
        }
        await ensureWebhooksTable();
        const [id] = await (0, connection_1.dbTrack)('webhooks').insert({
            url,
            barcode,
            event: event || 'status_change',
            active: true,
            created_at: new Date(),
        });
        res.status(201).json({ message: 'Webhook registrato con successo', id, url, barcode, event: event || 'status_change' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella registrazione del webhook' });
    }
});
// POST /webhook/fire — manually trigger webhook for a barcode
router.post('/webhook/fire', async (req, res) => {
    try {
        trackApiUsage('POST /webhook/fire');
        const { barcode } = req.body;
        if (!barcode) {
            res.status(400).json({ error: 'Campo obbligatorio: barcode' });
            return;
        }
        await ensureWebhooksTable();
        // Get latest esito for context
        const latestEsito = await (0, connection_1.dbTrack)('esiti')
            .where({ barcode })
            .orderBy('id', 'desc')
            .first();
        const result = await fireWebhooksForBarcode(barcode, {
            event: 'manual_fire',
            ultimo_esito: latestEsito || null,
            fired_at: new Date().toISOString(),
        });
        res.json({
            message: `Webhook attivati per barcode "${barcode}"`,
            ...result,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'attivazione dei webhook' });
    }
});
// ════════════════════════════════════════════════════════════════
// 3. POSTINI
// ════════════════════════════════════════════════════════════════
// GET /postini — list all active postini with their current status
router.get('/postini', async (req, res) => {
    try {
        trackApiUsage('GET /postini');
        const postini = await (0, connection_1.dbTrack)('users')
            .where({ role: 'postino', active: true })
            .select('id', 'username');
        const result = postini.map((p) => {
            const heartbeat = deviceStatus_handler_1.deviceHeartbeats.get(p.id);
            const isOnline = heartbeat
                ? (Date.now() - new Date(heartbeat.lastSeen).getTime()) < 5 * 60 * 1000 // online if seen in last 5 min
                : false;
            return {
                id: p.id,
                username: p.username,
                stato: isOnline ? 'online' : 'offline',
                battery_level: heartbeat?.battery_level ?? null,
                battery_charging: heartbeat?.battery_charging ?? null,
                connection_type: heartbeat?.connection_type ?? null,
                last_seen: heartbeat?.lastSeen ?? null,
            };
        });
        res.json({ postini: result });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero dei postini' });
    }
});
// GET /postini/:id/posizione — last GPS position
router.get('/postini/:id/posizione', async (req, res) => {
    try {
        trackApiUsage('GET /postini/:id/posizione');
        const postinoId = parseInt(req.params.id, 10);
        // Try geolocation_log first
        const geoPos = await (0, connection_1.dbTrack)('geolocation_log')
            .where({ postino_id: postinoId })
            .orderBy('timestamp', 'desc')
            .first();
        if (geoPos) {
            res.json({
                postino_id: postinoId,
                latitudine: geoPos.latitudine,
                longitudine: geoPos.longitudine,
                timestamp: geoPos.timestamp,
                fonte: 'geolocation_log',
            });
            return;
        }
        // Fallback to esiti
        const esitoPos = await (0, connection_1.dbTrack)('esiti')
            .where({ postino_id: postinoId })
            .whereNotNull('latitudine')
            .whereNotNull('longitudine')
            .orderBy('data', 'desc')
            .orderBy('ora', 'desc')
            .first();
        if (esitoPos) {
            res.json({
                postino_id: postinoId,
                latitudine: esitoPos.latitudine,
                longitudine: esitoPos.longitudine,
                timestamp: `${esitoPos.data} ${esitoPos.ora}`,
                fonte: 'esiti',
            });
            return;
        }
        res.status(404).json({ error: `Nessuna posizione trovata per il postino ${postinoId}` });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero della posizione' });
    }
});
// GET /postini/:id/giornata — summary of today
router.get('/postini/:id/giornata', async (req, res) => {
    try {
        trackApiUsage('GET /postini/:id/giornata');
        const postinoId = parseInt(req.params.id, 10);
        const today = new Date().toISOString().substring(0, 10);
        // Total esiti today
        const esitiToday = await (0, connection_1.dbTrack)('esiti')
            .where({ postino_id: postinoId })
            .where('data', today);
        // Breakdown by type
        const breakdown = await (0, connection_1.dbTrack)('esiti')
            .select('esito')
            .count('* as count')
            .where({ postino_id: postinoId })
            .where('data', today)
            .groupBy('esito');
        // Start/end time
        const firstEsito = await (0, connection_1.dbTrack)('esiti')
            .where({ postino_id: postinoId })
            .where('data', today)
            .orderBy('ora', 'asc')
            .first();
        const lastEsito = await (0, connection_1.dbTrack)('esiti')
            .where({ postino_id: postinoId })
            .where('data', today)
            .orderBy('ora', 'desc')
            .first();
        // Calculate km traveled from GPS points today
        const geoPoints = await (0, connection_1.dbTrack)('geolocation_log')
            .where({ postino_id: postinoId })
            .where('timestamp', '>=', `${today} 00:00:00`)
            .where('timestamp', '<=', `${today} 23:59:59`)
            .orderBy('timestamp', 'asc')
            .select('latitudine', 'longitudine');
        let kmTraveled = 0;
        for (let i = 1; i < geoPoints.length; i++) {
            kmTraveled += haversineKm(geoPoints[i - 1].latitudine, geoPoints[i - 1].longitudine, geoPoints[i].latitudine, geoPoints[i].longitudine);
        }
        res.json({
            postino_id: postinoId,
            data: today,
            totale_esiti: esitiToday.length,
            breakdown,
            ora_inizio: firstEsito?.ora || null,
            ora_fine: lastEsito?.ora || null,
            km_percorsi: Math.round(kmTraveled * 100) / 100,
            punti_gps: geoPoints.length,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero del riepilogo giornaliero' });
    }
});
// ════════════════════════════════════════════════════════════════
// 4. REPORT
// ════════════════════════════════════════════════════════════════
// GET /report/giornaliero?data=YYYY-MM-DD
router.get('/report/giornaliero', async (req, res) => {
    try {
        trackApiUsage('GET /report/giornaliero');
        const data = req.query.data || new Date().toISOString().substring(0, 10);
        const report = await generateReportData(data, data);
        res.json(report);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella generazione del report giornaliero' });
    }
});
// GET /report/settimanale?data=YYYY-MM-DD
router.get('/report/settimanale', async (req, res) => {
    try {
        trackApiUsage('GET /report/settimanale');
        const data = req.query.data || new Date().toISOString().substring(0, 10);
        const d = new Date(data);
        const dayOfWeek = d.getDay();
        // Monday as start of week
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const dateFrom = monday.toISOString().substring(0, 10);
        const dateTo = sunday.toISOString().substring(0, 10);
        const report = await generateReportData(dateFrom, dateTo);
        res.json(report);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella generazione del report settimanale' });
    }
});
// GET /report/mensile?anno=YYYY&mese=MM
router.get('/report/mensile', async (req, res) => {
    try {
        trackApiUsage('GET /report/mensile');
        const anno = req.query.anno;
        const mese = req.query.mese;
        if (!anno || !mese) {
            res.status(400).json({ error: 'Parametri obbligatori: anno, mese' });
            return;
        }
        const dateFrom = `${anno}-${mese.padStart(2, '0')}-01`;
        const lastDay = new Date(parseInt(anno, 10), parseInt(mese, 10), 0).getDate();
        const dateTo = `${anno}-${mese.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const report = await generateReportData(dateFrom, dateTo);
        res.json(report);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella generazione del report mensile' });
    }
});
// GET /report/postino/:id?from=&to=
router.get('/report/postino/:id', async (req, res) => {
    try {
        trackApiUsage('GET /report/postino/:id');
        const postinoId = parseInt(req.params.id, 10);
        const dateFrom = req.query.from;
        const dateTo = req.query.to;
        if (!dateFrom || !dateTo) {
            res.status(400).json({ error: 'Parametri obbligatori: from, to' });
            return;
        }
        // Get postino info
        const postino = await (0, connection_1.dbTrack)('users').where({ id: postinoId }).first();
        if (!postino) {
            res.status(404).json({ error: `Postino con id ${postinoId} non trovato` });
            return;
        }
        // Total esiti
        const [totalResult] = await (0, connection_1.dbTrack)('esiti')
            .count('* as total')
            .where({ postino_id: postinoId })
            .where('data', '>=', dateFrom)
            .where('data', '<=', dateTo);
        const totalEsiti = totalResult.total || 0;
        // Success rate (consegnata vs total)
        const [successResult] = await (0, connection_1.dbTrack)('esiti')
            .count('* as count')
            .where({ postino_id: postinoId, esito: 'consegnata' })
            .where('data', '>=', dateFrom)
            .where('data', '<=', dateTo);
        const consegnate = successResult.count || 0;
        const successRate = totalEsiti > 0 ? Math.round((consegnate / totalEsiti) * 10000) / 100 : 0;
        // Days worked
        const daysWorked = await (0, connection_1.dbTrack)('esiti')
            .countDistinct('data as days')
            .where({ postino_id: postinoId })
            .where('data', '>=', dateFrom)
            .where('data', '<=', dateTo);
        const numDays = daysWorked[0].days || 1;
        const avgPerDay = Math.round((totalEsiti / numDays) * 100) / 100;
        // Breakdown by type
        const breakdown = await (0, connection_1.dbTrack)('esiti')
            .select('esito')
            .count('* as count')
            .where({ postino_id: postinoId })
            .where('data', '>=', dateFrom)
            .where('data', '<=', dateTo)
            .groupBy('esito');
        // Km traveled from GPS
        const geoPoints = await (0, connection_1.dbTrack)('geolocation_log')
            .where({ postino_id: postinoId })
            .where('timestamp', '>=', `${dateFrom} 00:00:00`)
            .where('timestamp', '<=', `${dateTo} 23:59:59`)
            .orderBy('timestamp', 'asc')
            .select('latitudine', 'longitudine', connection_1.dbTrack.raw('DATE(timestamp) as giorno'));
        let totalKm = 0;
        let prevDay = null;
        let prevPoint = null;
        for (const point of geoPoints) {
            if (prevPoint && point.giorno === prevDay) {
                totalKm += haversineKm(prevPoint.latitudine, prevPoint.longitudine, point.latitudine, point.longitudine);
            }
            prevDay = point.giorno;
            prevPoint = point;
        }
        res.json({
            postino_id: postinoId,
            username: postino.username,
            periodo: { da: dateFrom, a: dateTo },
            totale_esiti: totalEsiti,
            tasso_successo: `${successRate}%`,
            media_giornaliera: avgPerDay,
            giorni_lavorati: numDays,
            km_percorsi: Math.round(totalKm * 100) / 100,
            breakdown,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella generazione del report postino' });
    }
});
// GET /report/export/csv?from=&to=&postino=
router.get('/report/export/csv', async (req, res) => {
    try {
        trackApiUsage('GET /report/export/csv');
        const dateFrom = req.query.from;
        const dateTo = req.query.to;
        const postinoFilter = req.query.postino;
        if (!dateFrom || !dateTo) {
            res.status(400).json({ error: 'Parametri obbligatori: from, to' });
            return;
        }
        let query = (0, connection_1.dbTrack)('esiti')
            .where('data', '>=', dateFrom)
            .where('data', '<=', dateTo)
            .orderBy('data', 'asc')
            .orderBy('ora', 'asc');
        if (postinoFilter) {
            query = query.where('postino_id', parseInt(postinoFilter, 10));
        }
        const esiti = await query;
        // Get postino usernames
        const postinoIds = [...new Set(esiti.map((e) => e.postino_id))];
        let postiniMap = {};
        if (postinoIds.length > 0) {
            const postini = await (0, connection_1.dbTrack)('users').whereIn('id', postinoIds).select('id', 'username');
            postiniMap = Object.fromEntries(postini.map((p) => [p.id, p.username]));
        }
        // Build CSV
        const headers = ['id', 'barcode', 'esito', 'data', 'ora', 'postino_id', 'postino_username', 'latitudine', 'longitudine', 'note'];
        const csvLines = [headers.join(';')];
        for (const e of esiti) {
            const row = [
                e.id,
                e.barcode,
                e.esito,
                e.data,
                e.ora,
                e.postino_id,
                postiniMap[e.postino_id] || '',
                e.latitudine || '',
                e.longitudine || '',
                (e.note || '').replace(/;/g, ',').replace(/\n/g, ' '),
            ];
            csvLines.push(row.join(';'));
        }
        const csv = csvLines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="esiti_${dateFrom}_${dateTo}.csv"`);
        res.send(csv);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'esportazione CSV' });
    }
});
// GET /report/export/pdf?from=&to=
router.get('/report/export/pdf', async (req, res) => {
    try {
        trackApiUsage('GET /report/export/pdf');
        const dateFrom = req.query.from;
        const dateTo = req.query.to;
        if (!dateFrom || !dateTo) {
            res.status(400).json({ error: 'Parametri obbligatori: from, to' });
            return;
        }
        const reportData = await generateReportData(dateFrom, dateTo);
        const doc = new pdfkit_1.default({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="report_${dateFrom}_${dateTo}.pdf"`);
        doc.pipe(res);
        // Title
        doc.fontSize(20).text('Posta Network - Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Periodo: ${reportData.periodo.da} - ${reportData.periodo.a}`, { align: 'center' });
        doc.moveDown(1);
        // Summary
        doc.fontSize(14).text('Riepilogo', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).text(`Totale spedizioni: ${reportData.total_spedizioni}`);
        doc.moveDown(0.5);
        // Esiti breakdown
        doc.fontSize(14).text('Esiti per tipo', { underline: true });
        doc.moveDown(0.5);
        for (const item of reportData.esiti_breakdown) {
            doc.fontSize(11).text(`  ${item.esito}: ${item.count}`);
        }
        doc.moveDown(0.5);
        // Per postino
        doc.fontSize(14).text('Esiti per postino', { underline: true });
        doc.moveDown(0.5);
        for (const item of reportData.per_postino) {
            doc.fontSize(11).text(`  ${item.username}: ${item.count}`);
        }
        doc.moveDown(0.5);
        // Per zona
        if (reportData.per_zona.length > 0) {
            doc.fontSize(14).text('Per zona (top 20)', { underline: true });
            doc.moveDown(0.5);
            for (const item of reportData.per_zona.slice(0, 20)) {
                doc.fontSize(11).text(`  ${item.comune} (${item.cap}): ${item.count}`);
            }
        }
        // Footer
        doc.moveDown(1);
        doc.fontSize(9).fillColor('gray').text(`Generato il ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`, { align: 'center' });
        doc.end();
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella generazione del report PDF' });
    }
});
// ════════════════════════════════════════════════════════════════
// 5. GIACENZE
// ════════════════════════════════════════════════════════════════
// GET /giacenze — list active giacenze
router.get('/giacenze', async (req, res) => {
    try {
        trackApiUsage('GET /giacenze');
        const { page = '1', limit = '50' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        // Get esiti with 'in giacenza' that have NOT been followed by 'ritirato da giacenza'
        const giacenzeEsiti = await (0, connection_1.dbTrack)('esiti as e1')
            .select('e1.*')
            .where('e1.esito', 'in giacenza')
            .whereNotExists(function () {
            this.select('*')
                .from('esiti as e2')
                .whereRaw('e2.barcode = e1.barcode')
                .where('e2.esito', 'ritirato da giacenza')
                .whereRaw('e2.id > e1.id');
        })
            .orderBy('e1.data', 'desc')
            .limit(limitNum)
            .offset(offset);
        const [countResult] = await (0, connection_1.dbTrack)('esiti as e1')
            .count('* as total')
            .where('e1.esito', 'in giacenza')
            .whereNotExists(function () {
            this.select('*')
                .from('esiti as e2')
                .whereRaw('e2.barcode = e1.barcode')
                .where('e2.esito', 'ritirato da giacenza')
                .whereRaw('e2.id > e1.id');
        });
        const total = countResult.total || 0;
        // Get spedizioni info for destinatario
        const barcodes = giacenzeEsiti.map((e) => e.barcode);
        let spedMap = {};
        if (barcodes.length > 0) {
            const spedizioni = await (0, connection_1.dbSpedizioni)('spedizioni').whereIn('barcode', barcodes);
            spedMap = Object.fromEntries(spedizioni.map((s) => [s.barcode, s]));
        }
        const giacenze = giacenzeEsiti.map((e) => ({
            ...e,
            destinatario: spedMap[e.barcode] ? {
                nome: spedMap[e.barcode].destinatario_nome,
                cognome: spedMap[e.barcode].destinatario_cognome,
                indirizzo: spedMap[e.barcode].indirizzo,
                civico: spedMap[e.barcode].civico,
                cap: spedMap[e.barcode].cap,
                comune: spedMap[e.barcode].comune,
            } : null,
        }));
        res.json({
            giacenze,
            pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero delle giacenze' });
    }
});
// PUT /giacenze/:barcode/ritiro — mark giacenza as picked up
router.put('/giacenze/:barcode/ritiro', async (req, res) => {
    try {
        trackApiUsage('PUT /giacenze/:barcode/ritiro');
        const { barcode } = req.params;
        const user = req.user;
        // Verify there's an active giacenza for this barcode
        const giacenza = await (0, connection_1.dbTrack)('esiti')
            .where({ barcode, esito: 'in giacenza' })
            .whereNotExists(function () {
            this.select('*')
                .from('esiti as e2')
                .whereRaw('e2.barcode = esiti.barcode')
                .where('e2.esito', 'ritirato da giacenza')
                .whereRaw('e2.id > esiti.id');
        })
            .first();
        if (!giacenza) {
            res.status(404).json({ error: `Nessuna giacenza attiva trovata per il barcode "${barcode}"` });
            return;
        }
        // Create new esito 'ritirato da giacenza'
        const now = new Date();
        const [esitoId] = await (0, connection_1.dbTrack)('esiti').insert({
            barcode,
            esito: 'ritirato da giacenza',
            data: now.toISOString().substring(0, 10),
            ora: now.toTimeString().substring(0, 8),
            postino_id: user?.userId || giacenza.postino_id,
            note: 'Ritiro da giacenza registrato dal supervisore',
        });
        // Update spedizione stato
        await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).update({ stato: 'ritirata_giacenza' });
        res.json({ message: 'Giacenza ritirata con successo', barcode, esito_id: esitoId });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel ritiro della giacenza' });
    }
});
// GET /giacenze/scadute?giorni=7
router.get('/giacenze/scadute', async (req, res) => {
    try {
        trackApiUsage('GET /giacenze/scadute');
        const giorni = parseInt(req.query.giorni, 10) || 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - giorni);
        const cutoff = cutoffDate.toISOString().substring(0, 10);
        const scadute = await (0, connection_1.dbTrack)('esiti as e1')
            .select('e1.*')
            .where('e1.esito', 'in giacenza')
            .where('e1.data', '<=', cutoff)
            .whereNotExists(function () {
            this.select('*')
                .from('esiti as e2')
                .whereRaw('e2.barcode = e1.barcode')
                .where('e2.esito', 'ritirato da giacenza')
                .whereRaw('e2.id > e1.id');
        })
            .orderBy('e1.data', 'asc');
        // Get spedizioni info
        const barcodes = scadute.map((e) => e.barcode);
        let spedMap = {};
        if (barcodes.length > 0) {
            const spedizioni = await (0, connection_1.dbSpedizioni)('spedizioni').whereIn('barcode', barcodes);
            spedMap = Object.fromEntries(spedizioni.map((s) => [s.barcode, s]));
        }
        const result = scadute.map((e) => {
            const dataParts = e.data instanceof Date
                ? e.data
                : new Date(e.data);
            const giorniInGiacenza = Math.floor((Date.now() - dataParts.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...e,
                giorni_in_giacenza: giorniInGiacenza,
                destinatario: spedMap[e.barcode] ? {
                    nome: spedMap[e.barcode].destinatario_nome,
                    cognome: spedMap[e.barcode].destinatario_cognome,
                    indirizzo: spedMap[e.barcode].indirizzo,
                    comune: spedMap[e.barcode].comune,
                } : null,
            };
        });
        res.json({ giacenze_scadute: result, totale: result.length, soglia_giorni: giorni });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero delle giacenze scadute' });
    }
});
// ════════════════════════════════════════════════════════════════
// 6. DESTINATARI
// ════════════════════════════════════════════════════════════════
// GET /destinatari/search?q=text
router.get('/destinatari/search', async (req, res) => {
    try {
        trackApiUsage('GET /destinatari/search');
        const q = req.query.q;
        const { page = '1', limit = '50' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        if (!q || q.length < 2) {
            res.status(400).json({ error: 'Il parametro "q" deve essere di almeno 2 caratteri' });
            return;
        }
        const searchTerm = `%${(0, validators_1.escapeLikeWildcards)(q)}%`;
        const [countResult] = await (0, connection_1.dbSpedizioni)('spedizioni')
            .countDistinct(connection_1.dbSpedizioni.raw("CONCAT(destinatario_nome, ' ', destinatario_cognome, ' ', indirizzo) as total"))
            .where(function () {
            this.where('destinatario_nome', 'like', searchTerm)
                .orWhere('destinatario_cognome', 'like', searchTerm)
                .orWhere('indirizzo', 'like', searchTerm)
                .orWhere(connection_1.dbSpedizioni.raw("CONCAT(destinatario_nome, ' ', destinatario_cognome)"), 'like', searchTerm);
        });
        const destinatari = await (0, connection_1.dbSpedizioni)('spedizioni')
            .select('destinatario_nome', 'destinatario_cognome', 'indirizzo', 'civico', 'cap', 'comune', 'provincia')
            .where(function () {
            this.where('destinatario_nome', 'like', searchTerm)
                .orWhere('destinatario_cognome', 'like', searchTerm)
                .orWhere('indirizzo', 'like', searchTerm)
                .orWhere(connection_1.dbSpedizioni.raw("CONCAT(destinatario_nome, ' ', destinatario_cognome)"), 'like', searchTerm);
        })
            .groupBy('destinatario_nome', 'destinatario_cognome', 'indirizzo', 'civico', 'cap', 'comune', 'provincia')
            .limit(limitNum)
            .offset(offset);
        // For each unique destinatario, get last delivery info
        const results = [];
        for (const dest of destinatari) {
            const lastSpedizione = await (0, connection_1.dbSpedizioni)('spedizioni')
                .where({
                destinatario_nome: dest.destinatario_nome,
                destinatario_cognome: dest.destinatario_cognome,
                indirizzo: dest.indirizzo,
            })
                .orderBy('id', 'desc')
                .first();
            let ultimoEsito = null;
            if (lastSpedizione) {
                ultimoEsito = await (0, connection_1.dbTrack)('esiti')
                    .where({ barcode: lastSpedizione.barcode })
                    .orderBy('id', 'desc')
                    .first();
            }
            results.push({
                ...dest,
                ultima_spedizione: lastSpedizione ? {
                    barcode: lastSpedizione.barcode,
                    stato: lastSpedizione.stato,
                    data_assegnazione: lastSpedizione.data_assegnazione,
                } : null,
                ultimo_esito: ultimoEsito ? {
                    esito: ultimoEsito.esito,
                    data: ultimoEsito.data,
                    ora: ultimoEsito.ora,
                } : null,
            });
        }
        res.json({ destinatari: results });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella ricerca destinatari' });
    }
});
// GET /destinatari/:id/storico — all deliveries for a destinatario (by spedizione id)
router.get('/destinatari/:id/storico', async (req, res) => {
    try {
        trackApiUsage('GET /destinatari/:id/storico');
        const spedizioneId = parseInt(req.params.id, 10);
        // Get the destinatario info from this spedizione
        const refSpedizione = await (0, connection_1.dbSpedizioni)('spedizioni').where({ id: spedizioneId }).first();
        if (!refSpedizione) {
            res.status(404).json({ error: `Spedizione con id ${spedizioneId} non trovata` });
            return;
        }
        // Find all spedizioni for same destinatario
        const spedizioni = await (0, connection_1.dbSpedizioni)('spedizioni')
            .where({
            destinatario_nome: refSpedizione.destinatario_nome,
            destinatario_cognome: refSpedizione.destinatario_cognome,
            indirizzo: refSpedizione.indirizzo,
        })
            .orderBy('id', 'desc');
        // Get all esiti for these barcodes
        const barcodes = spedizioni.map((s) => s.barcode);
        let esitiMap = {};
        if (barcodes.length > 0) {
            const allEsiti = await (0, connection_1.dbTrack)('esiti')
                .whereIn('barcode', barcodes)
                .orderBy('data', 'desc')
                .orderBy('ora', 'desc');
            for (const e of allEsiti) {
                if (!esitiMap[e.barcode])
                    esitiMap[e.barcode] = [];
                esitiMap[e.barcode].push(e);
            }
        }
        res.json({
            destinatario: {
                nome: refSpedizione.destinatario_nome,
                cognome: refSpedizione.destinatario_cognome,
                indirizzo: refSpedizione.indirizzo,
                civico: refSpedizione.civico,
                cap: refSpedizione.cap,
                comune: refSpedizione.comune,
                provincia: refSpedizione.provincia,
            },
            storico: spedizioni.map((s) => ({
                ...s,
                esiti: esitiMap[s.barcode] || [],
            })),
            totale_spedizioni: spedizioni.length,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero dello storico destinatario' });
    }
});
// ════════════════════════════════════════════════════════════════
// 7. NOTIFICHE ESTERNE
// ════════════════════════════════════════════════════════════════
// POST /notifica/sms
router.post('/notifica/sms', async (req, res) => {
    try {
        trackApiUsage('POST /notifica/sms');
        const { telefono, messaggio } = req.body;
        if (!telefono || !messaggio) {
            res.status(400).json({ error: 'Campi obbligatori: telefono, messaggio' });
            return;
        }
        await ensureNotificationsLogTable();
        await (0, connection_1.dbTrack)('notifications_log').insert({
            tipo: 'sms',
            destinatario: telefono,
            oggetto: null,
            messaggio,
            stato: 'inviato',
            created_at: new Date(),
        });
        // Real SMS integration would go here (Twilio, etc.)
        res.json({ message: 'SMS registrato con successo', telefono, stato: 'inviato' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'invio dell\'SMS' });
    }
});
// POST /notifica/email
router.post('/notifica/email', async (req, res) => {
    try {
        trackApiUsage('POST /notifica/email');
        const { email, oggetto, messaggio } = req.body;
        if (!email || !messaggio) {
            res.status(400).json({ error: 'Campi obbligatori: email, messaggio' });
            return;
        }
        await ensureNotificationsLogTable();
        await (0, connection_1.dbTrack)('notifications_log').insert({
            tipo: 'email',
            destinatario: email,
            oggetto: oggetto || null,
            messaggio,
            stato: 'inviato',
            created_at: new Date(),
        });
        // Real email integration would go here (nodemailer, SendGrid, etc.)
        res.json({ message: 'Email registrata con successo', email, oggetto: oggetto || '(senza oggetto)', stato: 'inviato' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'invio dell\'email' });
    }
});
// ════════════════════════════════════════════════════════════════
// 8. SISTEMA
// ════════════════════════════════════════════════════════════════
// GET /system/health — detailed health
router.get('/system/health', async (req, res) => {
    try {
        trackApiUsage('GET /system/health');
        let dbTrackStatus = 'disconnected';
        let dbTrackLatency = -1;
        let dbSpedizioniStatus = 'disconnected';
        let dbSpedizioniLatency = -1;
        try {
            const t0 = Date.now();
            await connection_1.dbTrack.raw('SELECT 1');
            dbTrackLatency = Date.now() - t0;
            dbTrackStatus = 'connected';
        }
        catch { /* remain disconnected */ }
        try {
            const t0 = Date.now();
            await connection_1.dbSpedizioni.raw('SELECT 1');
            dbSpedizioniLatency = Date.now() - t0;
            dbSpedizioniStatus = 'connected';
        }
        catch { /* remain disconnected */ }
        const mem = process.memoryUsage();
        const uptimeSeconds = process.uptime();
        // Socket connections count from deviceHeartbeats
        const activePostini = deviceStatus_handler_1.deviceHeartbeats.size;
        res.json({
            status: (dbTrackStatus === 'connected' && dbSpedizioniStatus === 'connected') ? 'healthy' : 'degraded',
            database: {
                track: { status: dbTrackStatus, latency_ms: dbTrackLatency },
                spedizioni: { status: dbSpedizioniStatus, latency_ms: dbSpedizioniLatency },
            },
            memory: {
                heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
                heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
                rss_mb: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
                external_mb: Math.round(mem.external / 1024 / 1024 * 10) / 10,
            },
            uptime_seconds: Math.round(uptimeSeconds),
            uptime_human: `${Math.floor(uptimeSeconds / 86400)}d ${Math.floor((uptimeSeconds % 86400) / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`,
            active_postini_connections: activePostini,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel controllo dello stato del sistema' });
    }
});
// GET /system/usage — API usage stats
router.get('/system/usage', async (req, res) => {
    try {
        trackApiUsage('GET /system/usage');
        res.json({
            usage: apiUsageCounters,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero delle statistiche di utilizzo' });
    }
});
// GET /system/audit?from=&to=&user=
router.get('/system/audit', async (req, res) => {
    try {
        trackApiUsage('GET /system/audit');
        const { from, to, user, page = '1', limit = '50' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        let query = (0, connection_1.dbTrack)('audit_trail').select('*');
        let countQuery = (0, connection_1.dbTrack)('audit_trail').count('* as total');
        if (from) {
            query = query.where('created_at', '>=', from);
            countQuery = countQuery.where('created_at', '>=', from);
        }
        if (to) {
            query = query.where('created_at', '<=', `${to} 23:59:59`);
            countQuery = countQuery.where('created_at', '<=', `${to} 23:59:59`);
        }
        if (user) {
            query = query.where('postino_id', parseInt(user, 10));
            countQuery = countQuery.where('postino_id', parseInt(user, 10));
        }
        const [totalResult] = await countQuery;
        const total = totalResult.total || 0;
        const records = await query.orderBy('created_at', 'desc').limit(limitNum).offset(offset);
        res.json({
            audit: records,
            pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero dell\'audit trail' });
    }
});
// ─── API Giacenze per sistemi esterni (autenticazione via API key) ───
// GET /data/giacenze — lista giacenze con filtro opzionale per postino
// Query params: ?postino_id=X (opzionale), ?stato=attiva|risolta|ritirata (opzionale, default: attiva)
router.get('/giacenze', apiKeyAuth_1.checkApiKeyPermission, async (req, res) => {
    try {
        trackApiUsage('GET /giacenze');
        const postinoId = req.query.postino_id;
        const stato = req.query.stato || 'attiva';
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        // Build query from esiti table (latest esito per barcode)
        let query = connection_1.dbTrack.raw(`
      WITH latest_esiti AS (
        SELECT id, barcode, esito, data, ora, latitudine, longitudine, postino_id, note, created_at,
          ROW_NUMBER() OVER (PARTITION BY barcode ORDER BY data DESC, ora DESC, id DESC) AS rn
        FROM esiti
      )
      SELECT id, barcode, esito, data, ora, latitudine, longitudine, postino_id, note, created_at
      FROM latest_esiti
      WHERE rn = 1 AND esito IN ('in giacenza', 'giacenza')
      ${postinoId ? 'AND postino_id = ?' : ''}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...(postinoId ? [postinoId] : []), limit, (page - 1) * limit]);
        const giacenze = await query.then((rows) => rows[0] || rows);
        // Enrich with spedizioni data
        const barcodes = giacenze.map((g) => g.barcode);
        const spedizioni = barcodes.length > 0
            ? await (0, connection_1.dbSpedizioni)('spedizioni').whereIn('barcode', barcodes).select('barcode', 'destinatario_nome', 'destinatario_cognome', 'indirizzo', 'civico', 'comune', 'cap', 'provincia', 'tipo_posta')
            : [];
        const spedMap = new Map(spedizioni.map((s) => [s.barcode, s]));
        // Enrich with postino username
        const postinoIds = [...new Set(giacenze.map((g) => g.postino_id))];
        const postini = postinoIds.length > 0
            ? await (0, connection_1.dbTrack)('users').whereIn('id', postinoIds).select('id', 'username')
            : [];
        const postinoMap = new Map(postini.map((p) => [p.id, p.username]));
        const enriched = giacenze.map((g) => {
            const sped = spedMap.get(g.barcode);
            return {
                id: g.id,
                barcode: g.barcode,
                esito: g.esito,
                data: g.data,
                ora: g.ora,
                latitudine: g.latitudine,
                longitudine: g.longitudine,
                postino_id: g.postino_id,
                postino_username: postinoMap.get(g.postino_id) || `Postino #${g.postino_id}`,
                note: g.note,
                created_at: g.created_at,
                destinatario_nome: sped?.destinatario_nome || '',
                destinatario_cognome: sped?.destinatario_cognome || '',
                indirizzo: sped?.indirizzo || '',
                civico: sped?.civico || '',
                comune: sped?.comune || '',
                cap: sped?.cap || '',
                provincia: sped?.provincia || '',
                tipo_posta: sped?.tipo_posta || '',
            };
        });
        res.json({
            giacenze: enriched,
            totale: enriched.length,
            pagina: page,
            per_pagina: limit,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero giacenze' });
    }
});
// GET /data/giacenze/stats — conteggio giacenze per postino
router.get('/giacenze/stats', apiKeyAuth_1.checkApiKeyPermission, async (_req, res) => {
    try {
        trackApiUsage('GET /giacenze/stats');
        // Get all active giacenze grouped by postino
        const stats = await connection_1.dbTrack.raw(`
      WITH latest_esiti AS (
        SELECT barcode, esito, postino_id,
          ROW_NUMBER() OVER (PARTITION BY barcode ORDER BY data DESC, ora DESC, id DESC) AS rn
        FROM esiti
      )
      SELECT
        le.postino_id,
        u.username,
        COUNT(*) as attive
      FROM latest_esiti le
      LEFT JOIN users u ON le.postino_id = u.id
      WHERE le.rn = 1 AND le.esito IN ('in giacenza', 'giacenza')
      GROUP BY le.postino_id, u.username
      ORDER BY attive DESC
    `).then((rows) => rows[0] || rows);
        // Get resolved giacenze count from giacenze table
        const risolte = await (0, connection_1.dbTrack)('giacenze')
            .select('postino_id')
            .where('stato', '!=', 'attiva')
            .count('* as risolte')
            .groupBy('postino_id')
            .then((rows) => new Map(rows.map(r => [r.postino_id, parseInt(r.risolte)])))
            .catch(() => new Map());
        const totaleAttive = stats.reduce((sum, s) => sum + parseInt(s.attive), 0);
        const giacenzePerPostino = stats.map((s) => ({
            postino_id: s.postino_id,
            username: s.username || `Postino #${s.postino_id}`,
            attive: parseInt(s.attive),
            risolte: risolte.get(s.postino_id) || 0,
            totale: parseInt(s.attive) + (risolte.get(s.postino_id) || 0),
        }));
        res.json({
            giacenze_per_postino: giacenzePerPostino,
            totale_attive: totaleAttive,
            totale_postini_con_giacenze: giacenzePerPostino.length,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero statistiche giacenze' });
    }
});
exports.default = router;
//# sourceMappingURL=data.routes.js.map