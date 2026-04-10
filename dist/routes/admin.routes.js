"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../middleware/permissions");
const ipWhitelist_1 = require("../middleware/ipWhitelist");
const csrf_1 = require("../middleware/csrf");
const apiKeyAuth_1 = require("../middleware/apiKeyAuth");
const admin_controller_1 = require("../controllers/admin.controller");
const deviceStatus_handler_1 = require("../socket/deviceStatus.handler");
const connection_1 = require("../db/connection");
const router = (0, express_1.Router)();
// Ensure permissions column exists on startup
(0, permissions_1.ensurePermissionsColumn)().catch(err => console.error('Failed to ensure permissions column:', err));
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('supervisore'));
// IP whitelist — applied after auth so only admin routes are restricted
router.use(ipWhitelist_1.ipWhitelistMiddleware);
// SH1: CSRF protection — set cookie and verify on state-changing requests
router.use(csrf_1.setCsrfCookie);
router.use(csrf_1.verifyCsrfToken);
// Permissions list endpoint (no permission check needed — any supervisore can see available permissions)
router.get('/permissions', (_req, res) => {
    res.json({
        permissions: permissions_1.ALL_PERMISSIONS.map(p => ({
            key: p,
            label: permissions_1.PERMISSION_LABELS[p] || p,
        })),
    });
});
// Dashboard & Stats
router.get('/dashboard', (0, permissions_1.requirePermission)('dashboard'), admin_controller_1.getDashboard);
router.get('/statistics', (0, permissions_1.requirePermission)('statistiche'), admin_controller_1.getStatistics);
// Live Feed
router.get('/live-feed', (0, permissions_1.requirePermission)('dashboard'), admin_controller_1.getLiveFeed);
// Users CRUD
router.get('/users', (0, permissions_1.requirePermission)('gestione_utenti'), admin_controller_1.getUsers);
router.post('/users', (0, permissions_1.requirePermission)('gestione_utenti'), admin_controller_1.createUser);
router.put('/users/:id', (0, permissions_1.requirePermission)('gestione_utenti'), admin_controller_1.updateUser);
router.put('/users/:id/password', (0, permissions_1.requirePermission)('gestione_utenti'), admin_controller_1.resetPassword);
router.delete('/users/:id', (0, permissions_1.requirePermission)('gestione_utenti'), admin_controller_1.deleteUser);
router.get('/postini', (0, permissions_1.requirePermission)('gestione_utenti', 'spedizioni', 'mappa_live'), admin_controller_1.getPostini);
// Devices
router.get('/devices', (0, permissions_1.requirePermission)('dispositivi'), admin_controller_1.getDevices);
// Device Status (real-time heartbeat data)
router.get('/device-status', (0, permissions_1.requirePermission)('dispositivi'), async (req, res) => {
    try {
        // Get all postini users
        const postini = await (0, connection_1.dbTrack)('users')
            .where({ role: 'postino', active: true })
            .select('id', 'username');
        const now = Date.now();
        const FIVE_MINUTES = 5 * 60 * 1000;
        const THIRTY_MINUTES = 30 * 60 * 1000;
        const devices = postini.map((p) => {
            const heartbeat = deviceStatus_handler_1.deviceHeartbeats.get(p.id);
            if (!heartbeat) {
                return {
                    userId: p.id,
                    username: p.username,
                    battery_level: null,
                    battery_charging: null,
                    connection_type: null,
                    lastSeen: null,
                    lastSeenRelative: 'Mai connesso',
                    status: 'offline',
                    low_battery: false,
                };
            }
            const lastSeenMs = new Date(heartbeat.lastSeen).getTime();
            const diff = now - lastSeenMs;
            let status = 'online';
            if (diff > THIRTY_MINUTES)
                status = 'offline';
            else if (diff > FIVE_MINUTES)
                status = 'inactive';
            const low_battery = heartbeat.battery_level !== null && heartbeat.battery_level < 0.15;
            // Calculate relative time
            let lastSeenRelative = '';
            if (diff < 60000)
                lastSeenRelative = 'Adesso';
            else if (diff < 3600000)
                lastSeenRelative = `${Math.floor(diff / 60000)} min fa`;
            else if (diff < 86400000)
                lastSeenRelative = `${Math.floor(diff / 3600000)} ore fa`;
            else
                lastSeenRelative = `${Math.floor(diff / 86400000)} giorni fa`;
            return {
                userId: p.id,
                username: p.username,
                battery_level: heartbeat.battery_level,
                battery_charging: heartbeat.battery_charging,
                connection_type: heartbeat.connection_type,
                lastSeen: heartbeat.lastSeen,
                lastSeenRelative,
                status,
                low_battery,
            };
        });
        res.json({ devices });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero stato dispositivi' });
    }
});
router.put('/devices/block/:deviceId', (0, permissions_1.requirePermission)('dispositivi'), admin_controller_1.blockDevice);
router.put('/devices/unblock/:deviceId', (0, permissions_1.requirePermission)('dispositivi'), admin_controller_1.unblockDevice);
// Shipments
router.get('/shipments', (0, permissions_1.requirePermission)('spedizioni'), admin_controller_1.getShipments);
router.post('/shipments/assign', (0, permissions_1.requirePermission)('spedizioni'), admin_controller_1.assignShipment);
router.post('/shipments/bulk-assign', (0, permissions_1.requirePermission)('spedizioni'), admin_controller_1.bulkAssign);
router.post('/shipments/create', (0, permissions_1.requirePermission)('spedizioni'), admin_controller_1.createShipment);
// Esiti Lavorati (all scanned items from esiti table)
router.get('/esiti-lavorati', (0, permissions_1.requirePermission)('spedizioni'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const barcode = (req.query.barcode || '').trim();
        const esito = (req.query.esito || '').trim();
        const postino = (req.query.postino || '').trim();
        let query = (0, connection_1.dbTrack)('esiti')
            .leftJoin('users', 'esiti.postino_id', 'users.id')
            .select('esiti.id', 'esiti.barcode', 'esiti.esito', 'esiti.data', 'esiti.ora', 'esiti.latitudine', 'esiti.longitudine', 'esiti.note', 'esiti.postino_id', 'users.username as postino_username')
            .orderBy('esiti.created_at', 'desc');
        let countQuery = (0, connection_1.dbTrack)('esiti').count('* as count');
        if (barcode) {
            const { escapeLikeWildcards } = await Promise.resolve().then(() => __importStar(require('../utils/validators')));
            const safeBarcode = escapeLikeWildcards(barcode);
            query = query.where('esiti.barcode', 'like', `%${safeBarcode}%`);
            countQuery = countQuery.where('esiti.barcode', 'like', `%${safeBarcode}%`);
        }
        if (esito) {
            query = query.where('esiti.esito', esito);
            countQuery = countQuery.where('esiti.esito', esito);
        }
        if (postino) {
            query = query.where('esiti.postino_id', postino);
            countQuery = countQuery.where('esiti.postino_id', postino);
        }
        const total = await countQuery.first();
        const esiti = await query.limit(limit).offset((page - 1) * limit);
        res.json({
            esiti,
            totale: total?.count || 0,
            pagina: page,
            per_pagina: limit,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero esiti lavorati' });
    }
});
// Delete single esito (with giacenza cascade)
router.delete('/esiti/:id', (0, permissions_1.requirePermission)('spedizioni'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) {
        res.status(400).json({ error: 'ID esito non valido' });
        return;
    }
    try {
        // Fetch esito before deleting (for audit + giacenza cascade)
        const esito = await (0, connection_1.dbTrack)('esiti').where({ id }).first();
        if (!esito) {
            res.status(404).json({ error: 'Esito non trovato' });
            return;
        }
        // If esito was giacenza/in giacenza, also remove from giacenze table
        const esitoLower = (esito.esito || '').toLowerCase();
        if (esitoLower === 'giacenza' || esitoLower === 'in giacenza') {
            await (0, connection_1.dbTrack)('giacenze').where({ barcode: esito.barcode, stato: 'attiva' }).del();
            console.log(`[INFO] Giacenza removed (cascade from esito delete) barcode=${esito.barcode} by=${req.user?.username}`);
        }
        // Delete the esito
        await (0, connection_1.dbTrack)('esiti').where({ id }).del();
        // Audit log
        console.log(`[INFO] Esito deleted id=${id} barcode=${esito.barcode} esito=${esito.esito} postino_id=${esito.postino_id} by=${req.user?.username}`);
        res.json({ message: 'Esito eliminato', barcode: esito.barcode });
    }
    catch (err) {
        console.error(`[ERROR] Delete esito error id=${id}`, err.message);
        res.status(500).json({ error: 'Errore nell\'eliminazione dell\'esito' });
    }
});
// Archive
router.post('/archive', (0, permissions_1.requirePermission)('archivio'), admin_controller_1.archiveAuto);
router.post('/archive/day', (0, permissions_1.requirePermission)('archivio'), admin_controller_1.archiveDay);
router.get('/archive/search', (0, permissions_1.requirePermission)('archivio'), admin_controller_1.archiveSearch);
// Import CSV
router.post('/import/csv', (0, permissions_1.requirePermission)('import_csv'), admin_controller_1.uploadMiddleware.single('file'), admin_controller_1.importCSV);
// Giacenze
router.get('/giacenze', (0, permissions_1.requirePermission)('giacenze'), admin_controller_1.getGiacenze);
router.put('/giacenze/:id/reassign', (0, permissions_1.requirePermission)('giacenze'), async (req, res) => {
    try {
        const { id } = req.params;
        const { postino_id } = req.body;
        if (!postino_id) {
            res.status(400).json({ error: 'postino_id obbligatorio' });
            return;
        }
        const postino = await (0, connection_1.dbTrack)('users').where({ id: postino_id, role: 'postino', active: true }).first();
        if (!postino) {
            res.status(400).json({ error: 'Postino non trovato o non attivo' });
            return;
        }
        const updated = await (0, connection_1.dbTrack)('giacenze').where({ id: parseInt(id) }).update({ postino_id });
        if (!updated) {
            res.status(404).json({ error: 'Giacenza non trovata' });
            return;
        }
        res.json({ message: 'Giacenza riassegnata' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella riassegnazione' });
    }
});
router.delete('/giacenze/:id', (0, permissions_1.requirePermission)('giacenze'), async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await (0, connection_1.dbTrack)('giacenze').where({ id: parseInt(id) }).delete();
        if (!deleted) {
            res.status(404).json({ error: 'Giacenza non trovata' });
            return;
        }
        res.json({ message: 'Giacenza eliminata' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'eliminazione' });
    }
});
// Map / Geo
router.get('/positions', (0, permissions_1.requirePermission)('mappa_live'), admin_controller_1.getPositions);
// Alerts
router.get('/alerts', (0, permissions_1.requirePermission)('avvisi'), admin_controller_1.getAlerts);
// Access Logs
router.get('/access-logs', (0, permissions_1.requirePermission)('log_accessi'), admin_controller_1.getAccessLogs);
// Export & Reports
router.get('/export/excel', (0, permissions_1.requirePermission)('esporta_excel'), admin_controller_1.exportExcel);
router.get('/export/pdf', (0, permissions_1.requirePermission)('report_pdf'), admin_controller_1.generatePDF);
// Backup — legacy summary endpoint
router.post('/backup', (0, permissions_1.requirePermission)('backup'), admin_controller_1.triggerBackup);
// Backup — new cloud backup system
router.get('/backup/download', (0, permissions_1.requirePermission)('backup'), async (req, res) => {
    try {
        const { exportData } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
        const format = (req.query.format || 'json').toLowerCase();
        const includeFoto = req.query.includeFoto === 'true';
        const includeFirma = req.query.includeFirma === 'true';
        const { buffer, metadata } = await exportData({ includeFoto, includeFirma, format });
        const date = new Date().toISOString().split('T')[0];
        const ext = format === 'csv' ? 'csv.gz' : 'json.gz';
        const filename = `backup_${date}.${ext}`;
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Length', buffer.length.toString());
        res.send(buffer);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel download backup' });
    }
});
router.get('/backup/config', (0, permissions_1.requirePermission)('backup'), async (_req, res) => {
    try {
        const { getBackupConfig } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
        const cfg = await getBackupConfig();
        if (!cfg) {
            res.json({ config: null });
            return;
        }
        // Mask secrets for display
        const masked = {
            ...cfg,
            secretAccessKey: cfg.secretAccessKey ? '••••••••' : '',
        };
        res.json({ config: masked });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero configurazione backup' });
    }
});
router.put('/backup/config', (0, permissions_1.requirePermission)('backup'), async (req, res) => {
    try {
        const { saveBackupConfig, getBackupConfig } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
        const incoming = req.body;
        // If secretAccessKey is masked, keep the existing one
        if (incoming.secretAccessKey === '••••••••') {
            const existing = await getBackupConfig();
            if (existing) {
                incoming.secretAccessKey = existing.secretAccessKey;
            }
        }
        const result = await saveBackupConfig(incoming);
        if (!result.success) {
            res.status(400).json({ error: 'Validazione fallita', errors: result.errors });
            return;
        }
        // Notify scheduler to re-schedule
        try {
            const { rescheduleBackup } = await Promise.resolve().then(() => __importStar(require('../index')));
            await rescheduleBackup();
        }
        catch { /* scheduler may not be available */ }
        res.json({ success: true, message: 'Configurazione salvata' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel salvataggio configurazione' });
    }
});
router.post('/backup/test', (0, permissions_1.requirePermission)('backup'), async (req, res) => {
    try {
        const { testCloudConnection, getBackupConfig } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
        // Use saved config merged with any provided overrides
        const saved = await getBackupConfig();
        const cfg = { ...(saved || {}), ...req.body };
        if (!cfg.endpoint || !cfg.accessKeyId || !cfg.bucket) {
            res.status(400).json({ success: false, message: 'Configurazione incompleta: endpoint, accessKeyId e bucket sono obbligatori' });
            return;
        }
        // If secret is masked, use saved
        if (cfg.secretAccessKey === '••••••••' && saved) {
            cfg.secretAccessKey = saved.secretAccessKey;
        }
        const result = await testCloudConnection(cfg);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Errore nel test connessione' });
    }
});
router.post('/backup/run', (0, permissions_1.requirePermission)('backup'), async (_req, res) => {
    try {
        const { runScheduledBackup } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
        const result = await runScheduledBackup();
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Errore nell\'esecuzione backup' });
    }
});
router.get('/backup/history', (0, permissions_1.requirePermission)('backup'), async (_req, res) => {
    try {
        const { listCloudBackups, getBackupConfig } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
        const cfg = await getBackupConfig();
        if (!cfg || !cfg.endpoint || !cfg.accessKeyId || !cfg.bucket) {
            res.json({ backups: [], message: 'Configurazione cloud non presente' });
            return;
        }
        // If secret missing, can't list
        if (!cfg.secretAccessKey) {
            res.json({ backups: [], message: 'Credenziali incomplete' });
            return;
        }
        const backups = await listCloudBackups(cfg);
        res.json({ backups });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero storico backup' });
    }
});
// DC2: Recovery endpoint for failed cross-DB updates
router.post('/recovery/cross-db', (0, permissions_1.requirePermission)('backup'), async (req, res) => {
    try {
        const { retryFailedCrossDbUpdates } = await Promise.resolve().then(() => __importStar(require('../services/deliveries.service')));
        const result = await retryFailedCrossDbUpdates();
        res.json({ message: 'Retry completato', ...result });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel retry cross-DB' });
    }
});
// Postino Route Tracking
router.get('/postino-route/:postinoId', (0, permissions_1.requirePermission)('mappa_live'), admin_controller_1.getPostinoRoute);
// Configuratore (App Config)
router.get('/config', (0, permissions_1.requirePermission)('configuratore'), admin_controller_1.getAppConfig);
router.get('/config/defaults', (0, permissions_1.requirePermission)('configuratore'), admin_controller_1.getAppConfigDefaults);
router.put('/config/:key', (0, permissions_1.requirePermission)('configuratore'), async (req, res) => {
    await (0, admin_controller_1.updateAppConfig)(req, res);
    // Invalidate IP whitelist cache when ip_whitelist config is updated
    if (req.params.key === 'ip_whitelist') {
        (0, ipWhitelist_1.invalidateIpWhitelistCache)();
    }
});
router.post('/config/reset/:key', (0, permissions_1.requirePermission)('configuratore'), async (req, res) => {
    await (0, admin_controller_1.resetAppConfig)(req, res);
    if (req.params.key === 'ip_whitelist') {
        (0, ipWhitelist_1.invalidateIpWhitelistCache)();
    }
});
// Current IP (for admin panel)
router.get('/my-ip', ipWhitelist_1.getCurrentIp);
// ════════════════════════════════════════════════════
// API Keys Management
// ════════════════════════════════════════════════════
// GET /api/v1/admin/api-keys — list all API keys
router.get('/api-keys', (0, permissions_1.requirePermission)('configuratore'), async (req, res) => {
    try {
        const keys = await (0, connection_1.dbTrack)('api_keys')
            .select('id', 'name', 'key_prefix', 'permissions', 'last_used_at', 'last_used_ip', 'requests_count', 'active', 'created_at', 'created_by')
            .orderBy('created_at', 'desc');
        const result = keys.map((k) => ({
            ...k,
            permissions: (() => { try {
                return JSON.parse(k.permissions);
            }
            catch {
                return [];
            } })(),
        }));
        res.json({ api_keys: result });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero delle API Keys' });
    }
});
// POST /api/v1/admin/api-keys — create new API key
router.post('/api-keys', (0, permissions_1.requirePermission)('configuratore'), async (req, res) => {
    try {
        const { name, permissions } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ error: 'Nome obbligatorio' });
            return;
        }
        const validPermissions = ['read', 'write', 'all'];
        const perms = Array.isArray(permissions) ? permissions.filter((p) => validPermissions.includes(p)) : ['read'];
        if (perms.length === 0) {
            res.status(400).json({ error: 'Almeno un permesso richiesto (read, write, all)' });
            return;
        }
        // Generate key
        const fullKey = (0, apiKeyAuth_1.generateApiKey)();
        const keyPrefix = fullKey.substring(0, 12);
        const keyHash = await (0, apiKeyAuth_1.hashApiKey)(fullKey);
        // Insert into DB
        const [id] = await (0, connection_1.dbTrack)('api_keys').insert({
            name: name.trim(),
            key_prefix: keyPrefix,
            key_hash: keyHash,
            permissions: JSON.stringify(perms),
            active: true,
            created_at: connection_1.dbTrack.fn.now(),
            created_by: req.user?.userId || null,
        });
        // Invalidate cache
        (0, apiKeyAuth_1.invalidateApiKeyCache)();
        // Return the full key — this is the ONLY time it will be shown
        res.status(201).json({
            id,
            name: name.trim(),
            key: fullKey,
            key_prefix: keyPrefix,
            permissions: perms,
            message: 'Chiave API creata. Copia la chiave ora, non sarà più visibile.',
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella creazione della API Key' });
    }
});
// PUT /api/v1/admin/api-keys/:id — update API key (name, permissions, active)
router.put('/api-keys/:id', (0, permissions_1.requirePermission)('configuratore'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, permissions, active } = req.body;
        const existing = await (0, connection_1.dbTrack)('api_keys').where({ id }).first();
        if (!existing) {
            res.status(404).json({ error: 'API Key non trovata' });
            return;
        }
        const updates = {};
        if (name !== undefined && name.trim()) {
            updates.name = name.trim();
        }
        if (permissions !== undefined) {
            const validPermissions = ['read', 'write', 'all'];
            const perms = Array.isArray(permissions) ? permissions.filter((p) => validPermissions.includes(p)) : [];
            if (perms.length > 0) {
                updates.permissions = JSON.stringify(perms);
            }
        }
        if (active !== undefined) {
            updates.active = !!active;
        }
        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'Nessuna modifica fornita' });
            return;
        }
        await (0, connection_1.dbTrack)('api_keys').where({ id }).update(updates);
        (0, apiKeyAuth_1.invalidateApiKeyCache)();
        res.json({ success: true, message: 'API Key aggiornata' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'aggiornamento della API Key' });
    }
});
// DELETE /api/v1/admin/api-keys/:id — delete API key
router.delete('/api-keys/:id', (0, permissions_1.requirePermission)('configuratore'), async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await (0, connection_1.dbTrack)('api_keys').where({ id }).first();
        if (!existing) {
            res.status(404).json({ error: 'API Key non trovata' });
            return;
        }
        await (0, connection_1.dbTrack)('api_keys').where({ id }).delete();
        (0, apiKeyAuth_1.invalidateApiKeyCache)();
        res.json({ success: true, message: 'API Key eliminata' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'eliminazione della API Key' });
    }
});
// POST /api/v1/admin/api-keys/:id/revoke — revoke (deactivate) API key
router.post('/api-keys/:id/revoke', (0, permissions_1.requirePermission)('configuratore'), async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await (0, connection_1.dbTrack)('api_keys').where({ id }).first();
        if (!existing) {
            res.status(404).json({ error: 'API Key non trovata' });
            return;
        }
        await (0, connection_1.dbTrack)('api_keys').where({ id }).update({ active: false });
        (0, apiKeyAuth_1.invalidateApiKeyCache)();
        res.json({ success: true, message: 'API Key revocata' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella revoca della API Key' });
    }
});
// ════════════════════════════════════════════════════
// Error Logs (Mini-Sentry)
// ════════════════════════════════════════════════════
// GET /api/v1/admin/error-logs
router.get('/error-logs', (0, permissions_1.requirePermission)('configuratore'), async (req, res) => {
    try {
        const { level, resolved, page = '1', limit = '50', from, to } = req.query;
        const p = parseInt(page) || 1;
        const lim = Math.min(parseInt(limit) || 50, 200);
        let query = (0, connection_1.dbTrack)('error_logs').orderBy('last_seen', 'desc');
        let countQuery = (0, connection_1.dbTrack)('error_logs').count('* as count');
        if (level) {
            query = query.where('level', level);
            countQuery = countQuery.where('level', level);
        }
        if (resolved !== undefined && resolved !== '') {
            const r = resolved === 'true' || resolved === '1' ? 1 : 0;
            query = query.where('resolved', r);
            countQuery = countQuery.where('resolved', r);
        }
        if (from) {
            query = query.where('created_at', '>=', from);
            countQuery = countQuery.where('created_at', '>=', from);
        }
        if (to) {
            query = query.where('created_at', '<=', to);
            countQuery = countQuery.where('created_at', '<=', to);
        }
        const total = await countQuery.first();
        const logs = await query.limit(lim).offset((p - 1) * lim);
        // Stats
        const stats = await (0, connection_1.dbTrack)('error_logs')
            .select(connection_1.dbTrack.raw('COUNT(*) as totale'), connection_1.dbTrack.raw('SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as non_risolti'), connection_1.dbTrack.raw('SUM(CASE WHEN level = \'error\' AND resolved = 0 THEN 1 ELSE 0 END) as errori_attivi'), connection_1.dbTrack.raw('SUM(CASE WHEN level = \'warning\' AND resolved = 0 THEN 1 ELSE 0 END) as warning_attivi'), connection_1.dbTrack.raw('SUM(occurrences) as occorrenze_totali'))
            .first();
        res.json({
            logs,
            totale: total?.count || 0,
            pagina: p,
            per_pagina: lim,
            stats,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero dei log errori' });
    }
});
// PUT /api/v1/admin/error-logs/:id/resolve
router.put('/error-logs/:id/resolve', (0, permissions_1.requirePermission)('configuratore'), async (req, res) => {
    try {
        await (0, connection_1.dbTrack)('error_logs')
            .where({ id: req.params.id })
            .update({ resolved: true, resolved_at: connection_1.dbTrack.fn.now() });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'aggiornamento' });
    }
});
// PUT /api/v1/admin/error-logs/resolve-all
router.put('/error-logs-resolve-all', (0, permissions_1.requirePermission)('configuratore'), async (_req, res) => {
    try {
        const updated = await (0, connection_1.dbTrack)('error_logs')
            .where({ resolved: false })
            .update({ resolved: true, resolved_at: connection_1.dbTrack.fn.now() });
        res.json({ success: true, resolved: updated });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'aggiornamento' });
    }
});
// DELETE /api/v1/admin/error-logs/cleanup — delete resolved logs older than 30 days
router.delete('/error-logs/cleanup', (0, permissions_1.requirePermission)('configuratore'), async (_req, res) => {
    try {
        const deleted = await (0, connection_1.dbTrack)('error_logs')
            .where('resolved', true)
            .where('created_at', '<', connection_1.dbTrack.raw("DATE_SUB(NOW(), INTERVAL 30 DAY)"))
            .delete();
        res.json({ success: true, deleted });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella pulizia log' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map