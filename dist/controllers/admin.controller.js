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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = void 0;
exports.getDashboard = getDashboard;
exports.getStatistics = getStatistics;
exports.getUsers = getUsers;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.resetPassword = resetPassword;
exports.deleteUser = deleteUser;
exports.getDevices = getDevices;
exports.blockDevice = blockDevice;
exports.unblockDevice = unblockDevice;
exports.exportExcel = exportExcel;
exports.importCSV = importCSV;
exports.getShipments = getShipments;
exports.assignShipment = assignShipment;
exports.bulkAssign = bulkAssign;
exports.getGiacenze = getGiacenze;
exports.getPositions = getPositions;
exports.getAlerts = getAlerts;
exports.getAccessLogs = getAccessLogs;
exports.generatePDF = generatePDF;
exports.triggerBackup = triggerBackup;
exports.getPostini = getPostini;
exports.getLiveFeed = getLiveFeed;
exports.getAppConfig = getAppConfig;
exports.getAppConfigDefaults = getAppConfigDefaults;
exports.updateAppConfig = updateAppConfig;
exports.resetAppConfig = resetAppConfig;
exports.archiveAuto = archiveAuto;
exports.archiveDay = archiveDay;
exports.archiveSearch = archiveSearch;
exports.createShipment = createShipment;
exports.getPostinoRoute = getPostinoRoute;
const connection_1 = require("../db/connection");
const auth_service_1 = require("../services/auth.service");
const logger_1 = require("../utils/logger");
const permissions_1 = require("../middleware/permissions");
const validators_1 = require("../utils/validators");
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const sync_1 = require("csv-parse/sync");
const multer_1 = __importDefault(require("multer"));
const authService = new auth_service_1.AuthService();
// ============ DASHBOARD ============
async function getDashboard(req, res) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        // DH2: Batch all independent queries in parallel to avoid sequential N+1-like overhead
        const [[totalToday], esitiBreakdown, perPostino, assegnatePerPostino, allPostini, [totalSpedizioni], [spedizioniPendenti], [spedizioniConsegnate],] = await Promise.all([
            (0, connection_1.dbTrack)('esiti').where('data', '>=', today).where('data', '<', tomorrow).count('* as count'),
            (0, connection_1.dbTrack)('esiti').where('data', '>=', today).where('data', '<', tomorrow).groupBy('esito').select('esito', connection_1.dbTrack.raw('COUNT(*) as count')),
            (0, connection_1.dbTrack)('esiti').where('data', '>=', today).where('data', '<', tomorrow).leftJoin('users', 'esiti.postino_id', 'users.id').groupBy('postino_id', 'users.username').select('postino_id', 'users.username', connection_1.dbTrack.raw('COUNT(*) as count')),
            (0, connection_1.dbSpedizioni)('spedizioni').whereIn('stato', ['assegnata', 'da_lavorare']).whereNotNull('postino_id').groupBy('postino_id').select('postino_id', connection_1.dbSpedizioni.raw('COUNT(*) as assegnate')),
            (0, connection_1.dbTrack)('users').where({ role: 'postino', active: true }).select('id', 'username'),
            (0, connection_1.dbSpedizioni)('spedizioni').count('* as count'),
            (0, connection_1.dbSpedizioni)('spedizioni').whereIn('stato', ['assegnata', 'da_lavorare']).count('* as count'),
            (0, connection_1.dbSpedizioni)('spedizioni').where('stato', 'consegnata').count('* as count'),
        ]);
        const esitiMap = new Map(perPostino.map((e) => [e.postino_id, parseInt(e.count) || 0]));
        const assegnateMap = new Map(assegnatePerPostino.map((a) => [a.postino_id, parseInt(a.assegnate) || 0]));
        const perPostinoFull = allPostini.map((p) => ({
            postino_id: p.id,
            username: p.username,
            esiti_oggi: esitiMap.get(p.id) || 0,
            assegnate: assegnateMap.get(p.id) || 0,
        }));
        res.json({
            data: today,
            totale_esiti: totalToday.count,
            breakdown_esiti: esitiBreakdown,
            per_postino: perPostinoFull,
            totale_spedizioni: totalSpedizioni.count,
            spedizioni_pendenti: spedizioniPendenti.count,
            spedizioni_consegnate: spedizioniConsegnate.count,
        });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Dashboard error', { error: err.message });
        res.status(500).json({ error: 'Errore nel caricamento dashboard' });
    }
}
// ============ STATISTICS (CHARTS) ============
async function getStatistics(req, res) {
    try {
        const { giorni } = req.query;
        const days = parseInt(giorni) || 30;
        const dailyStats = await (0, connection_1.dbTrack)('esiti')
            .whereRaw('data >= DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days])
            .groupByRaw('DATE(data)')
            .select(connection_1.dbTrack.raw('DATE(data) as giorno'), connection_1.dbTrack.raw('COUNT(*) as totale'), connection_1.dbTrack.raw("SUM(CASE WHEN esito = 'consegnato' THEN 1 ELSE 0 END) as consegnati"), connection_1.dbTrack.raw("SUM(CASE WHEN esito != 'consegnato' THEN 1 ELSE 0 END) as non_consegnati"))
            .orderBy('giorno', 'asc');
        const avgPerDay = await connection_1.dbTrack.raw(`
      SELECT ROUND(AVG(daily_count), 1) as media_giornaliera
      FROM (SELECT COUNT(*) as daily_count FROM esiti WHERE data >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY DATE(data)) as daily
    `, [days]);
        res.json({ daily: dailyStats, media: avgPerDay[0]?.[0]?.media_giornaliera || 0 });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Statistics error', { error: err.message });
        res.status(500).json({ error: 'Errore nel caricamento statistiche' });
    }
}
// ============ USERS CRUD ============
async function ensureFirmaOverrideColumn() {
    try {
        const has = await connection_1.dbTrack.schema.hasColumn('users', 'firma_override');
        if (!has) {
            await connection_1.dbTrack.schema.alterTable('users', (table) => {
                table.string('firma_override', 20).nullable().defaultTo(null);
            });
        }
    }
    catch { /* column may already exist */ }
}
async function ensureTelefonoColumn() {
    try {
        const has = await connection_1.dbTrack.schema.hasColumn('users', 'telefono');
        if (!has) {
            await connection_1.dbTrack.schema.alterTable('users', (table) => {
                table.string('telefono', 20).nullable().defaultTo(null);
            });
        }
    }
    catch { /* column may already exist */ }
}
async function getUsers(req, res) {
    try {
        await ensureFirmaOverrideColumn();
        await ensureTelefonoColumn();
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const users = await (0, connection_1.dbTrack)('users')
            .select('id', 'username', 'role', 'active', 'failed_attempts', 'locked_until', 'permissions', 'firma_override', 'telefono')
            .limit(limit)
            .offset((page - 1) * limit);
        const [{ count }] = await (0, connection_1.dbTrack)('users').count('* as count');
        res.json({ users, totale: count, pagina: page, per_pagina: limit });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero utenti' });
    }
}
async function createUser(req, res) {
    const { username, nome, cognome, email, password, role, permissions, telefono } = req.body;
    if (!username || !password || !role || !email || !nome || !cognome) {
        res.status(400).json({ error: 'Campi obbligatori: username, nome, cognome, email, password, role' });
        return;
    }
    // SH6: Enforce password policy on user creation
    const policyError = (0, validators_1.validatePasswordPolicy)(password);
    if (policyError) {
        res.status(400).json({ error: policyError });
        return;
    }
    try {
        await ensureTelefonoColumn();
        const existing = await (0, connection_1.dbTrack)('users').where({ username }).first();
        if (existing) {
            res.status(409).json({ error: 'Username già esistente' });
            return;
        }
        const password_hash = await authService.hashPassword(password);
        // Auto-assign permissions based on role
        const POSTINO_PERMS = ['dashboard', 'spedizioni', 'giacenze'];
        const permissionsValue = role === 'supervisore'
            ? JSON.stringify(permissions_1.ALL_PERMISSIONS)
            : JSON.stringify(POSTINO_PERMS);
        const telefonoValue = telefono ? String(telefono).replace(/[\s\-()]/g, '') : null;
        const [id] = await (0, connection_1.dbTrack)('users').insert({ username, nome, cognome, email, password_hash, role, active: true, failed_attempts: 0, permissions: permissionsValue, telefono: telefonoValue });
        (0, logger_1.log)('info', 'User created', { id, username, role, permissions: permissionsValue, telefono: telefonoValue, by: req.user?.username });
        // Auto-create user in external gestionale DB
        if (process.env.EXTERNAL_SYNC_ENABLED === 'true') {
            try {
                const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
                // External DB uses bcrypt $2a$ with fixed salt
                const EXTERNAL_SALT = '$2a$07$9af581c4m3fCG76a1y5k5u';
                const extHash = await bcrypt.hash(password, EXTERNAL_SALT);
                const [extId] = await (0, connection_1.dbExternal)('db_utenti').insert({
                    id_cliente: 1,
                    email: email,
                    password: extHash,
                    nome: nome,
                    cognome: cognome,
                    tipo_utente: role === 'supervisore' ? 'ADMIN' : 'POSTINO',
                    stato: '1',
                    ultimo_accesso: new Date(),
                    data_reg: new Date(),
                    gestionale: 0,
                });
                // Save external user ID in our users table
                await (0, connection_1.dbTrack)('users').where({ id }).update({ external_user_id: extId });
                (0, logger_1.log)('info', 'External user created', { userId: id, externalId: extId });
            }
            catch (err) {
                (0, logger_1.log)('error', 'Failed to create external user', { userId: id, error: err.message });
            }
        }
        res.status(201).json({ id, message: 'Utente creato' });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Create user error', { error: err.message });
        res.status(500).json({ error: 'Errore nella creazione utente' });
    }
}
async function updateUser(req, res) {
    const { id } = req.params;
    const { username, nome, cognome, email, role, active, permissions, firma_override, telefono } = req.body;
    try {
        const update = {};
        if (username !== undefined)
            update.username = username;
        if (nome !== undefined)
            update.nome = nome;
        if (cognome !== undefined)
            update.cognome = cognome;
        if (email !== undefined)
            update.email = email;
        if (role !== undefined)
            update.role = role;
        if (active !== undefined)
            update.active = active;
        if (permissions !== undefined) {
            const validPerms = Array.isArray(permissions)
                ? permissions.filter((p) => permissions_1.ALL_PERMISSIONS.includes(p))
                : [];
            update.permissions = validPerms.length > 0 ? JSON.stringify(validPerms) : null;
        }
        if (firma_override !== undefined) {
            await ensureFirmaOverrideColumn();
            const validValues = ['disabled', 'optional', 'required', null, ''];
            update.firma_override = validValues.includes(firma_override) ? (firma_override || null) : null;
        }
        if (telefono !== undefined) {
            await ensureTelefonoColumn();
            update.telefono = telefono ? String(telefono).replace(/[\s\-()]/g, '') : null;
        }
        await (0, connection_1.dbTrack)('users').where({ id }).update(update);
        (0, logger_1.log)('info', 'User updated', { id, update, by: req.user?.username });
        res.json({ message: 'Utente aggiornato' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'aggiornamento utente' });
    }
}
async function resetPassword(req, res) {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) {
        res.status(400).json({ error: 'Password obbligatoria' });
        return;
    }
    // SH6: Enforce password policy on admin password reset
    const resetPolicyError = (0, validators_1.validatePasswordPolicy)(password);
    if (resetPolicyError) {
        res.status(400).json({ error: resetPolicyError });
        return;
    }
    try {
        const password_hash = await authService.hashPassword(password);
        await (0, connection_1.dbTrack)('users').where({ id }).update({ password_hash, failed_attempts: 0, locked_until: null });
        // Invalidate all existing sessions for this user
        await (0, connection_1.dbTrack)('refresh_tokens').where({ user_id: id }).del();
        // Sync password to external DB
        if (process.env.EXTERNAL_SYNC_ENABLED === 'true') {
            try {
                const user = await (0, connection_1.dbTrack)('users').where({ id }).select('external_user_id').first();
                if (user?.external_user_id) {
                    const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
                    const EXTERNAL_SALT = '$2a$07$9af581c4m3fCG76a1y5k5u';
                    const extHash = await bcrypt.hash(password, EXTERNAL_SALT);
                    await (0, connection_1.dbExternal)('db_utenti').where({ id_utente: user.external_user_id }).update({ password: extHash });
                    (0, logger_1.log)('info', 'External password synced', { userId: id, externalId: user.external_user_id });
                }
            }
            catch (err) {
                (0, logger_1.log)('error', 'Failed to sync external password', { userId: id, error: err.message });
            }
        }
        (0, logger_1.log)('info', 'Password reset + sessions invalidated', { userId: id, by: req.user?.username });
        res.json({ message: 'Password reimpostata e sessioni invalidate' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel reset password' });
    }
}
async function deleteUser(req, res) {
    const { id } = req.params;
    try {
        // Get external_user_id before deleting
        const user = await (0, connection_1.dbTrack)('users').where({ id }).select('external_user_id').first();
        await (0, connection_1.dbTrack)('refresh_tokens').where({ user_id: id }).del();
        await (0, connection_1.dbTrack)('users').where({ id }).del();
        (0, logger_1.log)('info', 'User deleted', { userId: id, by: req.user?.username });
        // Deactivate user in external gestionale DB
        if (process.env.EXTERNAL_SYNC_ENABLED === 'true' && user?.external_user_id) {
            try {
                await (0, connection_1.dbExternal)('db_utenti')
                    .where({ id_utente: user.external_user_id })
                    .update({ stato: '0' });
                (0, logger_1.log)('info', 'External user deactivated', { userId: id, externalId: user.external_user_id });
            }
            catch (err) {
                (0, logger_1.log)('error', 'Failed to deactivate external user', { userId: id, externalId: user.external_user_id, error: err.message });
            }
        }
        res.json({ message: 'Utente eliminato' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'eliminazione utente' });
    }
}
// ============ DEVICES ============
async function getDevices(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const devices = await (0, connection_1.dbTrack)('devices')
            .leftJoin('users', 'devices.user_id', 'users.id')
            .select('devices.*', 'users.username')
            .limit(limit)
            .offset((page - 1) * limit);
        const [{ count }] = await (0, connection_1.dbTrack)('devices').count('* as count');
        res.json({ devices, totale: count, pagina: page, per_pagina: limit });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero dispositivi' });
    }
}
async function blockDevice(req, res) {
    const deviceId = req.params.deviceId;
    try {
        await (0, connection_1.dbTrack)('devices').where({ device_id: deviceId }).update({ blocked: true });
        await (0, connection_1.dbTrack)('refresh_tokens').where({ device_id: deviceId }).del();
        (0, logger_1.log)('info', 'Device blocked', { deviceId, by: req.user?.username });
        res.json({ message: 'Dispositivo bloccato' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel blocco dispositivo' });
    }
}
async function unblockDevice(req, res) {
    const deviceId = req.params.deviceId;
    try {
        await (0, connection_1.dbTrack)('devices').where({ device_id: deviceId }).update({ blocked: false });
        (0, logger_1.log)('info', 'Device unblocked', { deviceId, by: req.user?.username });
        res.json({ message: 'Dispositivo sbloccato' });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nello sblocco dispositivo' });
    }
}
// ============ EXPORT EXCEL ============
async function exportExcel(req, res) {
    const { data_da, data_a, postino_id, esito } = req.query;
    try {
        let query = (0, connection_1.dbTrack)('esiti')
            .leftJoin('users', 'esiti.postino_id', 'users.id')
            .select('esiti.barcode', 'esiti.esito', 'esiti.data', 'esiti.ora', 'esiti.latitudine', 'esiti.longitudine', 'esiti.note', 'users.username as postino');
        if (data_da)
            query = query.where('esiti.data', '>=', data_da);
        if (data_a)
            query = query.where('esiti.data', '<=', data_a);
        if (postino_id)
            query = query.where('esiti.postino_id', postino_id);
        if (esito)
            query = query.where('esiti.esito', esito);
        const rows = await query.orderBy('esiti.data', 'desc');
        const workbook = new exceljs_1.default.Workbook();
        const sheet = workbook.addWorksheet('Spedizioni');
        sheet.columns = [
            { header: 'Barcode', key: 'barcode', width: 20 },
            { header: 'Esito', key: 'esito', width: 15 },
            { header: 'Data', key: 'data', width: 12 },
            { header: 'Ora', key: 'ora', width: 10 },
            { header: 'Postino', key: 'postino', width: 15 },
            { header: 'Latitudine', key: 'latitudine', width: 12 },
            { header: 'Longitudine', key: 'longitudine', width: 12 },
            { header: 'Note', key: 'note', width: 30 },
        ];
        rows.forEach((row) => sheet.addRow(row));
        sheet.getRow(1).font = { bold: true };
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=spedizioni_${new Date().toISOString().split('T')[0]}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nella generazione Excel' });
    }
}
// ============ IMPORT CSV ============
// M1: File filter — only allow text/csv for CSV imports
const csvFileFilter = (_req, file, cb) => {
    const allowedMimes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Tipo file non consentito: ${file.mimetype}. Solo CSV.`));
    }
};
exports.uploadMiddleware = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: csvFileFilter,
});
async function importCSV(req, res) {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Nessun file caricato' });
            return;
        }
        const content = req.file.buffer.toString('utf-8');
        const records = (0, sync_1.parse)(content, {
            columns: true,
            skip_empty_lines: true,
            delimiter: [',', ';'],
            trim: true,
        });
        let imported = 0;
        let errors = [];
        for (let i = 0; i < records.length; i++) {
            const row = records[i];
            try {
                // Map CSV columns flexibly
                const barcode = row.barcode || row.codice || row.Barcode || row.Codice || '';
                const destinatario = row.destinatario || row.Destinatario || row.destinatario_nome || '';
                const indirizzo = row.indirizzo || row.Indirizzo || row.via || '';
                const tipo = row.tipo || row.Tipo || row.tipo_spedizione || 'standard';
                if (!barcode || barcode.length < 3 || barcode.length > 100) {
                    errors.push({ riga: i + 2, errore: 'Barcode mancante o lunghezza non valida (3-100 caratteri)' });
                    continue;
                }
                if (destinatario.length > 255 || indirizzo.length > 500) {
                    errors.push({ riga: i + 2, errore: 'Destinatario o indirizzo troppo lungo' });
                    continue;
                }
                await (0, connection_1.dbSpedizioni)('spedizioni').insert({
                    barcode,
                    destinatario_nome: destinatario,
                    indirizzo,
                    tipo_posta: tipo,
                    data_assegnazione: new Date(),
                }).onConflict('barcode').ignore();
                imported++;
            }
            catch (err) {
                errors.push({ riga: i + 2, errore: err.message });
            }
        }
        (0, logger_1.log)('info', 'CSV import', { imported, errors: errors.length, by: req.user?.username });
        res.json({ imported, totale: records.length, errori: errors });
    }
    catch (err) {
        (0, logger_1.log)('error', 'CSV import error', { error: err.message });
        res.status(500).json({ error: 'Errore nell\'importazione CSV' });
    }
}
// ============ SHIPMENTS ============
async function getShipments(req, res) {
    try {
        const { assegnato, data, page, search } = req.query;
        const p = parseInt(page) || 1;
        const limit = 50;
        const searchTerm = (search || '').trim();
        let query = (0, connection_1.dbSpedizioni)('spedizioni')
            .select('spedizioni.*')
            .orderBy('data_assegnazione', 'desc');
        if (assegnato === 'no') {
            query = query.whereNull('postino_id');
        }
        else if (assegnato === 'si') {
            query = query.whereNotNull('postino_id');
        }
        if (data) {
            query = query.whereRaw('DATE(data_assegnazione) = ?', [data]);
        }
        if (searchTerm) {
            const safeSearch = (0, validators_1.escapeLikeWildcards)(searchTerm);
            query = query.where(function () {
                this.where('barcode', 'like', `%${safeSearch}%`)
                    .orWhere('destinatario_nome', 'like', `%${safeSearch}%`)
                    .orWhere('destinatario_cognome', 'like', `%${safeSearch}%`);
            });
        }
        const countQuery = (0, connection_1.dbSpedizioni)('spedizioni').count('* as count');
        if (assegnato === 'no')
            countQuery.whereNull('postino_id');
        else if (assegnato === 'si')
            countQuery.whereNotNull('postino_id');
        if (data)
            countQuery.whereRaw('DATE(data_assegnazione) = ?', [data]);
        if (searchTerm) {
            const safeSearch = (0, validators_1.escapeLikeWildcards)(searchTerm);
            countQuery.where(function () {
                this.where('barcode', 'like', `%${safeSearch}%`)
                    .orWhere('destinatario_nome', 'like', `%${safeSearch}%`)
                    .orWhere('destinatario_cognome', 'like', `%${safeSearch}%`);
            });
        }
        const total = await countQuery.first();
        const shipments = await query.limit(limit).offset((p - 1) * limit);
        res.json({ shipments, totale: total?.count || 0, pagina: p, per_pagina: limit });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Shipments error', { error: err.message });
        res.status(500).json({ error: 'Errore nel recupero spedizioni' });
    }
}
async function assignShipment(req, res) {
    const { barcode, postino_id } = req.body;
    if (!barcode || !postino_id) {
        res.status(400).json({ error: 'barcode e postino_id obbligatori' });
        return;
    }
    try {
        // Verify postino exists and has correct role
        const postino = await (0, connection_1.dbTrack)('users').where({ id: postino_id, role: 'postino', active: true }).first();
        if (!postino) {
            res.status(400).json({ error: 'Postino non trovato o non attivo' });
            return;
        }
        const stato = postino_id ? 'assegnata' : 'da_lavorare';
        const updated = await (0, connection_1.dbSpedizioni)('spedizioni')
            .where({ barcode })
            .update({ postino_id, stato, data_assegnazione: new Date() });
        if (updated === 0) {
            res.status(404).json({ error: 'Spedizione non trovata' });
            return;
        }
        (0, logger_1.log)('info', 'Shipment assigned', { barcode, postino_id, stato, by: req.user?.username });
        res.json({ message: 'Spedizione assegnata', barcode, stato, updated });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'assegnazione' });
    }
}
async function bulkAssign(req, res) {
    const { barcodes, postino_id } = req.body;
    if (!barcodes || !postino_id || !Array.isArray(barcodes)) {
        res.status(400).json({ error: 'barcodes (array) e postino_id obbligatori' });
        return;
    }
    try {
        const stato = postino_id ? 'assegnata' : 'da_lavorare';
        const updated = await (0, connection_1.dbSpedizioni)('spedizioni')
            .whereIn('barcode', barcodes)
            .update({ postino_id, stato, data_assegnazione: new Date() });
        (0, logger_1.log)('info', 'Bulk assign', { count: updated, postino_id, stato, by: req.user?.username });
        res.json({ message: `${updated} spedizioni assegnate` });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nell\'assegnazione multipla' });
    }
}
// ============ GIACENZE ============
async function getGiacenze(req, res) {
    try {
        const { stato, data_da, data_a, postino_id } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        // Read from esiti table (source of truth), not from giacenze table
        // "Attive" = esiti 'in giacenza' without a subsequent 'ritirato da giacenza'
        // "Ritirate" = esiti 'ritirato da giacenza'
        const isRitirate = stato === 'ritirata' || stato === 'ritirate';
        let query = (0, connection_1.dbTrack)('esiti as e1')
            .leftJoin('users', 'e1.postino_id', 'users.id')
            .select('e1.id', 'e1.barcode', 'e1.postino_id', 'users.username as postino_username', 'e1.data as data_giacenza', 'e1.ora', 'e1.latitudine', 'e1.longitudine', 'e1.note', 'e1.esito')
            .orderBy('e1.data', 'desc');
        let countQuery;
        if (isRitirate) {
            // Show esiti with 'ritirato da giacenza'
            query = query.where('e1.esito', 'ritirato da giacenza');
            countQuery = (0, connection_1.dbTrack)('esiti').where('esito', 'ritirato da giacenza').count('* as count');
        }
        else {
            // Show active giacenze: esiti 'in giacenza' without a subsequent 'ritirato da giacenza'
            query = query.where('e1.esito', 'in giacenza')
                .whereNotExists(function () {
                this.select('*')
                    .from('esiti as e2')
                    .whereRaw('e2.barcode = e1.barcode')
                    .where('e2.esito', 'ritirato da giacenza')
                    .whereRaw('e2.id > e1.id');
            });
            countQuery = (0, connection_1.dbTrack)('esiti as e1')
                .where('e1.esito', 'in giacenza')
                .whereNotExists(function () {
                this.select('*')
                    .from('esiti as e2')
                    .whereRaw('e2.barcode = e1.barcode')
                    .where('e2.esito', 'ritirato da giacenza')
                    .whereRaw('e2.id > e1.id');
            })
                .count('* as count');
        }
        // Postino filter
        if (postino_id) {
            query = query.where('e1.postino_id', postino_id);
            countQuery = countQuery.where(isRitirate ? 'postino_id' : 'e1.postino_id', postino_id);
        }
        // Date filters
        if (data_da) {
            query = query.where('e1.data', '>=', data_da);
            countQuery = countQuery.where(isRitirate ? 'data' : 'e1.data', '>=', data_da);
        }
        if (data_a) {
            query = query.where('e1.data', '<=', data_a + ' 23:59:59');
            countQuery = countQuery.where(isRitirate ? 'data' : 'e1.data', '<=', data_a + ' 23:59:59');
        }
        const total = await countQuery.first();
        const giacenze = await query.limit(limit).offset((page - 1) * limit);
        // Map to expected format (admin panel expects these fields)
        const mapped = giacenze.map((g) => ({
            ...g,
            stato: isRitirate ? 'ritirata' : 'attiva',
            scaffale: '',
            contenitore: '',
            numero_posizione: '',
            data_ritiro: null,
        }));
        res.json({
            giacenze: mapped,
            totale: total?.count || 0,
            pagina: page,
            per_pagina: limit,
        });
    }
    catch (err) {
        (0, logger_1.log)('error', 'getGiacenze error', { error: err.message });
        res.status(500).json({ error: 'Errore nel recupero giacenze' });
    }
}
// ============ GEOLOCATION (for map) ============
async function getPositions(req, res) {
    try {
        const positions = await (0, connection_1.dbTrack)('geolocation_log')
            .join('users', 'geolocation_log.postino_id', 'users.id')
            .select('geolocation_log.postino_id', 'users.username', 'geolocation_log.latitudine', 'geolocation_log.longitudine', 'geolocation_log.timestamp')
            .whereIn('geolocation_log.id', function () {
            this.select(connection_1.dbTrack.raw('MAX(id)'))
                .from('geolocation_log')
                .groupBy('postino_id');
        });
        res.json({ positions });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero posizioni' });
    }
}
// ============ ALERTS ============
async function getAlerts(req, res) {
    try {
        const alerts = [];
        // 1. Postini stazionari da troppo tempo (>30 min senza movimento)
        try {
            const stazionari = await connection_1.dbTrack.raw(`
        SELECT gl.postino_id, u.username, gl.latitudine, gl.longitudine, gl.timestamp,
          TIMESTAMPDIFF(MINUTE, gl.timestamp, NOW()) as minuti_fermo
        FROM geolocation_log gl
        JOIN users u ON gl.postino_id = u.id
        WHERE gl.id IN (SELECT MAX(id) FROM geolocation_log GROUP BY postino_id)
          AND TIMESTAMPDIFF(MINUTE, gl.timestamp, NOW()) > 30
          AND DATE(gl.timestamp) = CURDATE()
      `);
            if (stazionari[0]?.length > 0) {
                for (const s of stazionari[0]) {
                    alerts.push({
                        tipo: 'stazionario',
                        messaggio: `${s.username} fermo da ${s.minuti_fermo} minuti`,
                        dettagli: s,
                    });
                }
            }
        }
        catch (e) { /* table may not exist yet */ }
        // 2. Troppi esiti negativi oggi (>70% negativi)
        try {
            const negativi = await connection_1.dbTrack.raw(`
        SELECT postino_id, u.username,
          COUNT(*) as totale,
          SUM(CASE WHEN esito != 'consegnato' THEN 1 ELSE 0 END) as negativi,
          ROUND(SUM(CASE WHEN esito != 'consegnato' THEN 1 ELSE 0 END) * 100 / COUNT(*), 1) as perc_negativo
        FROM esiti
        JOIN users u ON esiti.postino_id = u.id
        WHERE DATE(data) = CURDATE()
        GROUP BY postino_id, u.username
        HAVING perc_negativo > 70 AND totale > 5
      `);
            if (negativi[0]?.length > 0) {
                for (const n of negativi[0]) {
                    alerts.push({
                        tipo: 'esiti_negativi',
                        messaggio: `${n.username}: ${n.perc_negativo}% esiti negativi (${n.negativi}/${n.totale})`,
                        dettagli: n,
                    });
                }
            }
        }
        catch (e) { /* ignore */ }
        // 3. Dispositivi offline (last_seen > 2 ore)
        try {
            const offline = await connection_1.dbTrack.raw(`
        SELECT d.device_id, d.device_name, u.username, d.last_seen,
          TIMESTAMPDIFF(HOUR, d.last_seen, NOW()) as ore_offline
        FROM devices d
        JOIN users u ON d.user_id = u.id
        WHERE d.blocked = 0
          AND TIMESTAMPDIFF(HOUR, d.last_seen, NOW()) > 2
          AND DATE(d.last_seen) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      `);
            if (offline[0]?.length > 0) {
                for (const o of offline[0]) {
                    alerts.push({
                        tipo: 'dispositivo_offline',
                        messaggio: `${o.username} (${o.device_name || o.device_id}) offline da ${o.ore_offline}h`,
                        dettagli: o,
                    });
                }
            }
        }
        catch (e) { /* ignore */ }
        res.json({ alerts, count: alerts.length });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Alerts error', { error: err.message });
        res.status(500).json({ error: 'Errore nel recupero alert' });
    }
}
// ============ ACCESS LOGS ============
async function getAccessLogs(req, res) {
    try {
        // Use refresh_tokens as a proxy for login sessions
        const logs = await (0, connection_1.dbTrack)('refresh_tokens')
            .join('users', 'refresh_tokens.user_id', 'users.id')
            .select('users.username', 'refresh_tokens.device_id', 'refresh_tokens.created_at', 'refresh_tokens.expires_at')
            .orderBy('refresh_tokens.created_at', 'desc')
            .limit(200);
        res.json({ logs });
    }
    catch (err) {
        // If created_at doesn't exist, try without it
        try {
            const logs = await (0, connection_1.dbTrack)('refresh_tokens')
                .join('users', 'refresh_tokens.user_id', 'users.id')
                .select('users.username', 'refresh_tokens.device_id', 'refresh_tokens.expires_at')
                .orderBy('refresh_tokens.id', 'desc')
                .limit(200);
            res.json({ logs });
        }
        catch (err2) {
            res.status(500).json({ error: 'Errore nel recupero log accessi' });
        }
    }
}
// ============ PDF REPORT ============
async function generatePDF(req, res) {
    const { data_da, data_a, postino_id } = req.query;
    try {
        let query = (0, connection_1.dbTrack)('esiti')
            .leftJoin('users', 'esiti.postino_id', 'users.id')
            .select('esiti.id', 'esiti.barcode', 'esiti.esito', 'esiti.data', 'esiti.ora', 'esiti.latitudine', 'esiti.longitudine', 'esiti.postino_id', 'esiti.note', 'users.username as postino');
        if (data_da)
            query = query.where('esiti.data', '>=', data_da);
        if (data_a)
            query = query.where('esiti.data', '<=', data_a);
        if (postino_id)
            query = query.where('esiti.postino_id', postino_id);
        const rows = await query.orderBy('esiti.data', 'desc').limit(500);
        // Stats
        const totale = rows.length;
        const consegnati = rows.filter((r) => r.esito === 'consegnato').length;
        const percentuale = totale > 0 ? ((consegnati / totale) * 100).toFixed(1) : '0';
        const doc = new pdfkit_1.default({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report_${new Date().toISOString().split('T')[0]}.pdf`);
        doc.pipe(res);
        // Header
        doc.fontSize(20).text('Posta Network - Report Consegne', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generato il: ${new Date().toLocaleDateString('it-IT')} ${new Date().toLocaleTimeString('it-IT')}`, { align: 'center' });
        if (data_da || data_a) {
            doc.text(`Periodo: ${data_da || '...'} - ${data_a || '...'}`, { align: 'center' });
        }
        doc.moveDown(2);
        // Summary
        doc.fontSize(14).text('Riepilogo', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(`Totale esiti: ${totale}`);
        doc.text(`Consegnati: ${consegnati} (${percentuale}%)`);
        doc.text(`Non consegnati: ${totale - consegnati}`);
        doc.moveDown(2);
        // Table
        doc.fontSize(14).text('Dettaglio', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(8);
        const colWidths = [150, 75, 65, 45, 60, 95];
        const headers = ['Barcode', 'Esito', 'Data', 'Ora', 'Postino', 'GPS'];
        const lineHeight = 12;
        // Header row
        doc.font('Helvetica-Bold');
        let x = 50;
        let headerY = doc.y;
        headers.forEach((h, i) => {
            doc.text(h, x, headerY, { width: colWidths[i], lineBreak: false, align: 'left' });
            x += colWidths[i];
        });
        doc.moveDown(1);
        // Data rows
        doc.font('Helvetica');
        const maxRows = Math.min(rows.length, 100);
        for (let i = 0; i < maxRows; i++) {
            const row = rows[i];
            if (doc.y > 750) {
                doc.addPage();
            }
            x = 50;
            const rowY = doc.y;
            const cellValues = [
                row.barcode || '',
                row.esito || '',
                row.data ? new Date(row.data).toLocaleDateString('it-IT') : '',
                (row.ora || '').substring(0, 5),
                row.postino || '',
                (row.latitudine && row.longitudine) ? `${Number(row.latitudine).toFixed(4)}, ${Number(row.longitudine).toFixed(4)}` : ''
            ];
            cellValues.forEach((val, idx) => {
                doc.text(val, x, rowY, { width: colWidths[idx], lineBreak: false, align: 'left' });
                x += colWidths[idx];
            });
            doc.y = rowY + lineHeight;
            doc.moveDown(0.2);
        }
        if (rows.length > maxRows) {
            doc.moveDown();
            doc.text(`... e altri ${rows.length - maxRows} record`, { align: 'center' });
        }
        doc.end();
    }
    catch (err) {
        (0, logger_1.log)('error', 'PDF generation error', { error: err.message });
        res.status(500).json({ error: 'Errore nella generazione PDF' });
    }
}
// ============ BACKUP ============
async function triggerBackup(req, res) {
    try {
        const format = (req.query.format || 'summary').toLowerCase();
        if (format === 'json') {
            // DC3: Full JSON data export
            const EXPORT_LIMIT = 50000; // Safety limit per table
            const [users, esiti, spedizioni, appConfig, auditTrail] = await Promise.all([
                (0, connection_1.dbTrack)('users').select('id', 'username', 'role', 'active', 'permissions', 'created_at').limit(EXPORT_LIMIT),
                (0, connection_1.dbTrack)('esiti').select('id', 'barcode', 'esito', 'data', 'ora', 'latitudine', 'longitudine', 'postino_id', 'note', 'created_at').limit(EXPORT_LIMIT),
                (0, connection_1.dbSpedizioni)('spedizioni').select('*').limit(EXPORT_LIMIT).catch(() => []),
                (0, connection_1.dbTrack)('app_config').select('*').catch(() => []),
                (0, connection_1.dbTrack)('audit_trail').select('*').limit(EXPORT_LIMIT).catch(() => []),
            ]);
            const backup = {
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '1.0',
                    generated_by: req.user?.username || 'unknown',
                },
                counts: {
                    users: users.length,
                    esiti: esiti.length,
                    spedizioni: spedizioni.length,
                    app_config: appConfig.length,
                    audit_trail: auditTrail.length,
                },
                data: {
                    users,
                    esiti,
                    spedizioni,
                    app_config: appConfig,
                    audit_trail: auditTrail,
                },
            };
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=backup_${new Date().toISOString().split('T')[0]}.json`);
            (0, logger_1.log)('info', 'Full JSON backup triggered', { by: req.user?.username, counts: backup.counts });
            res.json(backup);
            return;
        }
        // Default: summary mode (backward compatible)
        const [esitiCount] = await (0, connection_1.dbTrack)('esiti').count('* as count');
        const [usersCount] = await (0, connection_1.dbTrack)('users').count('* as count');
        let giacenzeCount = { count: 0 };
        try {
            [giacenzeCount] = await (0, connection_1.dbTrack)('giacenza_posizioni').count('* as count');
        }
        catch { /* table may not exist */ }
        let spedizioniCount = { count: 0 };
        try {
            [spedizioniCount] = await (0, connection_1.dbSpedizioni)('spedizioni').count('* as count');
        }
        catch { /* ignore */ }
        const backupInfo = {
            timestamp: new Date().toISOString(),
            tabelle: {
                esiti: esitiCount.count,
                users: usersCount.count,
                giacenze: giacenzeCount.count,
                spedizioni: spedizioniCount.count,
            },
            stato: 'completato',
            note: 'Backup snapshot. Per export completo dei dati, usa ?format=json',
        };
        (0, logger_1.log)('info', 'Backup triggered', { by: req.user?.username, ...backupInfo.tabelle });
        res.json(backupInfo);
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel backup' });
    }
}
// ============ POSTINI LIST (for dropdowns) ============
async function getPostini(req, res) {
    try {
        const postini = await (0, connection_1.dbTrack)('users')
            .where({ role: 'postino', active: true })
            .select('id', 'username');
        res.json({ postini });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero postini' });
    }
}
// ============ LIVE FEED ============
async function getLiveFeed(req, res) {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        // M6: Use leftJoin (consistent with esiti-lavorati) and order by data+ora DESC
        const query = (0, connection_1.dbTrack)('esiti')
            .leftJoin('users', 'esiti.postino_id', 'users.id')
            .select('esiti.id', 'esiti.barcode', 'esiti.esito', 'esiti.data', 'esiti.ora', 'esiti.created_at', 'esiti.latitudine', 'esiti.longitudine', 'esiti.postino_id', 'users.username')
            .orderBy('esiti.data', 'desc')
            .orderBy('esiti.ora', 'desc')
            .limit(limit)
            .offset(offset);
        if (req.query.postino) {
            query.where('esiti.postino_id', req.query.postino);
        }
        if (req.query.esito) {
            query.where('esiti.esito', req.query.esito);
        }
        const feed = await query;
        res.json({ feed });
    }
    catch (err) {
        (0, logger_1.log)('error', 'getLiveFeed error', { error: String(err) });
        res.status(500).json({ error: 'Errore nel recupero feed live' });
    }
}
// ============ CONFIGURATORE (App Config) ============
const CONFIG_DEFAULTS = {
    tipi_spedizione: [
        { nome: 'Raccomandata', abbreviazione: 'RACC', colore: '#0066CC', priorita: 'media' },
        { nome: 'Atto Giudiziario', abbreviazione: 'AG', colore: '#F44336', priorita: 'alta' },
        { nome: 'Pacco', abbreviazione: 'PKG', colore: '#4CAF50', priorita: 'media' },
        { nome: 'Lettera', abbreviazione: 'LET', colore: '#9E9E9E', priorita: 'bassa' },
        { nome: 'Prioritaria', abbreviazione: 'PRI', colore: '#FF9800', priorita: 'alta' },
    ],
    esiti_consegna: {
        positivi: [
            { nome: 'Consegnato', colore: '#4CAF50', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'In Giacenza', colore: '#FF9800', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'Rifiutato', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
        ],
        negativi: [
            { nome: 'D.Sconosciuto', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'Indirizzo Errato', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: true },
            { nome: 'Trasferito', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'Deceduto', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'Fine Attività', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'Non ho rinvenuto il nominativo', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'Impossibile accedere a cassette', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'Info negative destinatario', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'Poste', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
            { nome: 'Altro', colore: '#8f00ff', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: true },
            { nome: 'Fine Giacenza', colore: '#F44336', foto_obbligatoria: false, firma_obbligatoria: false, note_obbligatorie: false },
        ],
    },
    zone_consegna: [],
    turni_orari: { inizio: '08:00', fine: '14:00', giorni: ['lun', 'mar', 'mer', 'gio', 'ven', 'sab'], pausa: false, durata_pausa: 0, auto_logout: false },
    gps_tracking: { intervallo_secondi: 30, risparmio_intervallo: 120, solo_durante_turno: true, distanza_minima_metri: 10, superpower_saver: true, accuracy_tracking: 'low', interval_tracking: 120, distance_tracking: 200, accuracy_scan: 'high', timeout_scan: 8, cache_max_age: 60, accuracy_filter: 50 },
    notifiche: { postino_nuova_assegnazione: true, postino_messaggio: true, postino_urgenza: true, supervisore_fermo_minuti: 30, supervisore_negativi_consecutivi: 5, supervisore_offline: true },
    stampa_giacenza: { punto_ritiro_indirizzo: '', punto_ritiro_orari: '', punto_ritiro_telefono: '', formato: '80mm', includi_qr: true },
    import_export: { mappature_salvate: [] },
    sicurezza: { lunghezza_min_password: 6, tentativi_blocco: 5, durata_sessione_ore: 8, cambio_password_giorni: 0 },
    branding: { nome_azienda: 'Posta Network', colore_primario: '#0066CC', messaggio_benvenuto: 'Benvenuto in Posta Network' },
    campi_personalizzati: [],
    regole_automatiche: { giacenza_dopo_tentativi: 3, notifica_giacenza_giorni: 7, alert_inattivita_minuti: 30, reso_automatico_giorni: 30 },
    ip_whitelist: { enabled: false, allowed_ips: [] },
    firma_policy: { global: 'optional', per_postino: {} },
    modalita_rapida: { enabled: true },
};
async function ensureAppConfigTable() {
    const exists = await connection_1.dbTrack.schema.hasTable('app_config');
    if (!exists) {
        await connection_1.dbTrack.schema.createTable('app_config', (table) => {
            table.increments('id').primary();
            table.string('chiave', 100).notNullable().unique();
            table.text('valore');
            table.timestamp('updated_at').defaultTo(connection_1.dbTrack.fn.now());
        });
    }
    else {
        // Ensure the chiave column exists (table might have old key/value schema)
        const hasChiave = await connection_1.dbTrack.schema.hasColumn('app_config', 'chiave');
        if (!hasChiave) {
            // Drop and recreate - config data is non-critical and will be re-populated from defaults
            await connection_1.dbTrack.schema.dropTable('app_config');
            await connection_1.dbTrack.schema.createTable('app_config', (table) => {
                table.increments('id').primary();
                table.string('chiave', 100).notNullable().unique();
                table.text('valore');
                table.timestamp('updated_at').defaultTo(connection_1.dbTrack.fn.now());
            });
            (0, logger_1.log)('info', 'app_config table recreated with correct schema (chiave/valore)');
        }
    }
}
async function getAppConfig(req, res) {
    try {
        await ensureAppConfigTable();
        const rows = await (0, connection_1.dbTrack)('app_config').select('chiave', 'valore');
        const config = {};
        for (const row of rows) {
            if (row.chiave) {
                try {
                    config[row.chiave] = JSON.parse(row.valore);
                }
                catch {
                    config[row.chiave] = row.valore;
                }
            }
        }
        // Merge with defaults for keys not in DB
        const merged = {};
        for (const key of Object.keys(CONFIG_DEFAULTS)) {
            merged[key] = config[key] !== undefined ? config[key] : CONFIG_DEFAULTS[key];
        }
        res.json(merged);
    }
    catch (err) {
        (0, logger_1.log)('error', 'getAppConfig error', { error: err.message });
        res.status(500).json({ error: 'Errore nel recupero configurazione' });
    }
}
async function getAppConfigDefaults(req, res) {
    res.json(CONFIG_DEFAULTS);
}
async function updateAppConfig(req, res) {
    const key = req.params.key;
    const { value } = req.body;
    if (!key || value === undefined) {
        res.status(400).json({ error: 'Chiave e valore obbligatori' });
        return;
    }
    if (!CONFIG_DEFAULTS.hasOwnProperty(key)) {
        res.status(400).json({ error: 'Chiave di configurazione non valida' });
        return;
    }
    try {
        await ensureAppConfigTable();
        const serialized = JSON.stringify(value);
        const existing = await (0, connection_1.dbTrack)('app_config').where({ chiave: key }).first();
        if (existing) {
            await (0, connection_1.dbTrack)('app_config').where({ chiave: key }).update({ valore: serialized, updated_at: new Date() });
        }
        else {
            await (0, connection_1.dbTrack)('app_config').insert({ chiave: key, valore: serialized, updated_at: new Date() });
        }
        (0, logger_1.log)('info', 'Config updated', { key, by: req.user?.username });
        res.json({ message: 'Configurazione aggiornata', key });
    }
    catch (err) {
        (0, logger_1.log)('error', 'updateAppConfig error', { error: err.message });
        res.status(500).json({ error: 'Errore nell\'aggiornamento configurazione' });
    }
}
async function resetAppConfig(req, res) {
    const key = req.params.key;
    if (!key || !CONFIG_DEFAULTS.hasOwnProperty(key)) {
        res.status(400).json({ error: 'Chiave di configurazione non valida' });
        return;
    }
    try {
        await ensureAppConfigTable();
        await (0, connection_1.dbTrack)('app_config').where({ chiave: key }).del();
        (0, logger_1.log)('info', 'Config reset to default', { key, by: req.user?.username });
        res.json({ message: 'Configurazione ripristinata ai valori predefiniti', key, value: CONFIG_DEFAULTS[key] });
    }
    catch (err) {
        (0, logger_1.log)('error', 'resetAppConfig error', { error: err.message });
        res.status(500).json({ error: 'Errore nel ripristino configurazione' });
    }
}
// ============ ARCHIVE SYSTEM ============
async function ensureArchiveTables() {
    const hasSpedizioniArchivio = await connection_1.dbSpedizioni.schema.hasTable('spedizioni_archivio');
    if (!hasSpedizioniArchivio) {
        await connection_1.dbSpedizioni.schema.createTable('spedizioni_archivio', (table) => {
            table.increments('id').primary();
            table.string('barcode', 100).notNullable();
            table.string('destinatario_nome', 255);
            table.string('destinatario_cognome', 255);
            table.string('indirizzo', 500);
            table.string('civico', 20);
            table.string('subcivico', 20);
            table.string('cap', 10);
            table.string('comune', 255);
            table.string('provincia', 10);
            table.string('tipo_posta', 100);
            table.string('tipo_spedizione', 100);
            table.string('stato', 50);
            table.integer('postino_id').unsigned().nullable();
            table.timestamp('data_assegnazione').nullable();
            table.timestamp('created_at').nullable();
            table.timestamp('archived_at').defaultTo(connection_1.dbSpedizioni.fn.now());
            table.index(['barcode']);
            table.index(['stato', 'data_assegnazione']);
            table.index(['postino_id']);
            table.index(['archived_at']);
        });
    }
    const hasEsitiArchivio = await connection_1.dbTrack.schema.hasTable('esiti_archivio');
    if (!hasEsitiArchivio) {
        await connection_1.dbTrack.schema.createTable('esiti_archivio', (table) => {
            table.increments('id').primary();
            table.string('barcode', 100).notNullable();
            table.integer('postino_id').unsigned().nullable();
            table.string('esito', 100);
            table.date('data').nullable();
            table.string('ora', 10);
            table.decimal('latitudine', 10, 7).nullable();
            table.decimal('longitudine', 10, 7).nullable();
            table.text('note').nullable();
            table.string('foto_path', 500).nullable();
            table.timestamp('created_at').nullable();
            table.timestamp('archived_at').defaultTo(connection_1.dbTrack.fn.now());
            table.index(['barcode']);
            table.index(['data']);
            table.index(['postino_id']);
            table.index(['archived_at']);
        });
    }
}
async function archiveAuto(req, res) {
    try {
        await ensureArchiveTables();
        const days = parseInt(req.body.days) || 3;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        // Find spedizioni to archive (consegnata or reso, older than X days)
        const toArchive = await (0, connection_1.dbSpedizioni)('spedizioni')
            .whereIn('stato', ['consegnata', 'reso'])
            .where('data_assegnazione', '<', cutoffStr)
            .select('*');
        let archivedSpedizioni = 0;
        let archivedEsiti = 0;
        const CHUNK_SIZE = 500;
        // Archive spedizioni in chunks
        for (let i = 0; i < toArchive.length; i += CHUNK_SIZE) {
            const chunk = toArchive.slice(i, i + CHUNK_SIZE);
            const archiveRows = chunk.map((row) => ({
                barcode: row.barcode,
                destinatario_nome: row.destinatario_nome,
                destinatario_cognome: row.destinatario_cognome,
                indirizzo: row.indirizzo,
                civico: row.civico,
                subcivico: row.subcivico,
                cap: row.cap,
                comune: row.comune,
                provincia: row.provincia,
                tipo_posta: row.tipo_posta,
                tipo_spedizione: row.tipo_spedizione,
                stato: row.stato,
                postino_id: row.postino_id,
                data_assegnazione: row.data_assegnazione,
                created_at: row.created_at,
                archived_at: new Date(),
            }));
            await (0, connection_1.dbSpedizioni)('spedizioni_archivio').insert(archiveRows);
            const barcodes = chunk.map((r) => r.barcode);
            await (0, connection_1.dbSpedizioni)('spedizioni').whereIn('barcode', barcodes).del();
            archivedSpedizioni += chunk.length;
        }
        // Archive related esiti
        if (toArchive.length > 0) {
            const allBarcodes = toArchive.map((r) => r.barcode);
            for (let i = 0; i < allBarcodes.length; i += CHUNK_SIZE) {
                const barcodeChunk = allBarcodes.slice(i, i + CHUNK_SIZE);
                const esitiToArchive = await (0, connection_1.dbTrack)('esiti')
                    .whereIn('barcode', barcodeChunk)
                    .select('*');
                if (esitiToArchive.length > 0) {
                    const esitiArchiveRows = esitiToArchive.map((row) => ({
                        barcode: row.barcode,
                        postino_id: row.postino_id,
                        esito: row.esito,
                        data: row.data,
                        ora: row.ora,
                        latitudine: row.latitudine,
                        longitudine: row.longitudine,
                        note: row.note,
                        foto_path: row.foto_path,
                        created_at: row.created_at,
                        archived_at: new Date(),
                    }));
                    await (0, connection_1.dbTrack)('esiti_archivio').insert(esitiArchiveRows);
                    await (0, connection_1.dbTrack)('esiti').whereIn('barcode', barcodeChunk).del();
                    archivedEsiti += esitiToArchive.length;
                }
            }
        }
        (0, logger_1.log)('info', 'Archive auto', { archivedSpedizioni, archivedEsiti, days, by: req.user?.username });
        res.json({
            message: 'Archiviazione completata',
            spedizioni_archiviate: archivedSpedizioni,
            esiti_archiviati: archivedEsiti,
            giorni_soglia: days,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Archive auto error', { error: err.message });
        res.status(500).json({ error: 'Errore nell\'archiviazione automatica' });
    }
}
async function archiveDay(req, res) {
    try {
        await ensureArchiveTables();
        const { date } = req.body;
        if (!date) {
            res.status(400).json({ error: 'Data obbligatoria' });
            return;
        }
        // Find completed spedizioni for the specific date
        const toArchive = await (0, connection_1.dbSpedizioni)('spedizioni')
            .whereIn('stato', ['consegnata', 'reso'])
            .whereRaw('DATE(data_assegnazione) = ?', [date])
            .select('*');
        let archivedSpedizioni = 0;
        let archivedEsiti = 0;
        const CHUNK_SIZE = 500;
        for (let i = 0; i < toArchive.length; i += CHUNK_SIZE) {
            const chunk = toArchive.slice(i, i + CHUNK_SIZE);
            const archiveRows = chunk.map((row) => ({
                barcode: row.barcode,
                destinatario_nome: row.destinatario_nome,
                destinatario_cognome: row.destinatario_cognome,
                indirizzo: row.indirizzo,
                civico: row.civico,
                subcivico: row.subcivico,
                cap: row.cap,
                comune: row.comune,
                provincia: row.provincia,
                tipo_posta: row.tipo_posta,
                tipo_spedizione: row.tipo_spedizione,
                stato: row.stato,
                postino_id: row.postino_id,
                data_assegnazione: row.data_assegnazione,
                created_at: row.created_at,
                archived_at: new Date(),
            }));
            await (0, connection_1.dbSpedizioni)('spedizioni_archivio').insert(archiveRows);
            const barcodes = chunk.map((r) => r.barcode);
            await (0, connection_1.dbSpedizioni)('spedizioni').whereIn('barcode', barcodes).del();
            archivedSpedizioni += chunk.length;
        }
        // Archive related esiti
        if (toArchive.length > 0) {
            const allBarcodes = toArchive.map((r) => r.barcode);
            for (let i = 0; i < allBarcodes.length; i += CHUNK_SIZE) {
                const barcodeChunk = allBarcodes.slice(i, i + CHUNK_SIZE);
                const esitiToArchive = await (0, connection_1.dbTrack)('esiti')
                    .whereIn('barcode', barcodeChunk)
                    .select('*');
                if (esitiToArchive.length > 0) {
                    const esitiArchiveRows = esitiToArchive.map((row) => ({
                        barcode: row.barcode,
                        postino_id: row.postino_id,
                        esito: row.esito,
                        data: row.data,
                        ora: row.ora,
                        latitudine: row.latitudine,
                        longitudine: row.longitudine,
                        note: row.note,
                        foto_path: row.foto_path,
                        created_at: row.created_at,
                        archived_at: new Date(),
                    }));
                    await (0, connection_1.dbTrack)('esiti_archivio').insert(esitiArchiveRows);
                    await (0, connection_1.dbTrack)('esiti').whereIn('barcode', barcodeChunk).del();
                    archivedEsiti += esitiToArchive.length;
                }
            }
        }
        (0, logger_1.log)('info', 'Archive day', { date, archivedSpedizioni, archivedEsiti, by: req.user?.username });
        res.json({
            message: `Giornata ${date} archiviata`,
            spedizioni_archiviate: archivedSpedizioni,
            esiti_archiviati: archivedEsiti,
            data: date,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Archive day error', { error: err.message });
        res.status(500).json({ error: 'Errore nell\'archiviazione giornata' });
    }
}
async function archiveSearch(req, res) {
    try {
        await ensureArchiveTables();
        const { barcode, date_from, date_to, postino_id, page } = req.query;
        const p = parseInt(page) || 1;
        const limit = 50;
        let query = (0, connection_1.dbSpedizioni)('spedizioni_archivio')
            .select('spedizioni_archivio.*')
            .orderBy('archived_at', 'desc');
        let countQuery = (0, connection_1.dbSpedizioni)('spedizioni_archivio').count('* as count');
        if (barcode) {
            const safeBarcode = (0, validators_1.escapeLikeWildcards)(barcode);
            query = query.where('spedizioni_archivio.barcode', 'like', `%${safeBarcode}%`);
            countQuery = countQuery.where('barcode', 'like', `%${safeBarcode}%`);
        }
        if (date_from) {
            query = query.where('spedizioni_archivio.data_assegnazione', '>=', date_from);
            countQuery = countQuery.where('data_assegnazione', '>=', date_from);
        }
        if (date_to) {
            query = query.where('spedizioni_archivio.data_assegnazione', '<=', date_to);
            countQuery = countQuery.where('data_assegnazione', '<=', date_to);
        }
        if (postino_id) {
            query = query.where('spedizioni_archivio.postino_id', postino_id);
            countQuery = countQuery.where('postino_id', postino_id);
        }
        const total = await countQuery.first();
        const spedizioni = await query.limit(limit).offset((p - 1) * limit);
        // Also search esiti_archivio for matched barcodes
        let esiti = [];
        if (barcode) {
            const safeBarcode2 = (0, validators_1.escapeLikeWildcards)(barcode);
            esiti = await (0, connection_1.dbTrack)('esiti_archivio')
                .where('barcode', 'like', `%${safeBarcode2}%`)
                .orderBy('archived_at', 'desc')
                .limit(50);
        }
        // Stats
        const [totalArchivedSpedizioni] = await (0, connection_1.dbSpedizioni)('spedizioni_archivio').count('* as count');
        const [totalArchivedEsiti] = await (0, connection_1.dbTrack)('esiti_archivio').count('* as count');
        // Last archive timestamp
        const lastArchive = await (0, connection_1.dbSpedizioni)('spedizioni_archivio')
            .orderBy('archived_at', 'desc')
            .first('archived_at');
        res.json({
            spedizioni,
            esiti,
            totale: total?.count || 0,
            pagina: p,
            per_pagina: limit,
            stats: {
                totale_spedizioni_archiviate: totalArchivedSpedizioni?.count || 0,
                totale_esiti_archiviati: totalArchivedEsiti?.count || 0,
                ultima_archiviazione: lastArchive?.archived_at || null,
            },
        });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Archive search error', { error: err.message });
        res.status(500).json({ error: 'Errore nella ricerca archivio' });
    }
}
// ============ MANUAL SHIPMENT CREATION ============
async function createShipment(req, res) {
    try {
        const { barcode, destinatario_nome, destinatario_cognome, indirizzo, civico, subcivico, cap, comune, provincia, tipo_posta, postino_id, } = req.body;
        if (!barcode) {
            res.status(400).json({ error: 'Barcode obbligatorio' });
            return;
        }
        // Check barcode uniqueness
        const existing = await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).first();
        if (existing) {
            res.status(409).json({ error: 'Barcode già esistente nel sistema' });
            return;
        }
        // Also check archive
        try {
            const existingArchive = await (0, connection_1.dbSpedizioni)('spedizioni_archivio').where({ barcode }).first();
            if (existingArchive) {
                res.status(409).json({ error: 'Barcode già presente nell\'archivio' });
                return;
            }
        }
        catch (e) { /* table may not exist */ }
        const stato = postino_id ? 'assegnata' : 'da_lavorare';
        await (0, connection_1.dbSpedizioni)('spedizioni').insert({
            barcode,
            destinatario_nome: destinatario_nome || null,
            destinatario_cognome: destinatario_cognome || null,
            indirizzo: indirizzo || null,
            civico: civico || null,
            subcivico: subcivico || null,
            cap: cap || null,
            comune: comune || null,
            provincia: provincia || null,
            tipo_posta: tipo_posta || null,
            postino_id: postino_id || null,
            stato,
            data_assegnazione: new Date(),
        });
        (0, logger_1.log)('info', 'Shipment created manually', { barcode, stato, postino_id, by: req.user?.username });
        res.status(201).json({ message: 'Spedizione creata', barcode, stato });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Create shipment error', { error: err.message });
        res.status(500).json({ error: 'Errore nella creazione spedizione' });
    }
}
// ============ POSTINO ROUTE TRACKING ============
async function getPostinoRoute(req, res) {
    try {
        const postinoId = parseInt(req.params.postinoId);
        if (isNaN(postinoId) || postinoId <= 0) {
            res.status(400).json({ error: 'postinoId non valido' });
            return;
        }
        // M5: Validate date parameter with proper date parsing
        const rawDate = req.query.date;
        let date;
        if (rawDate) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || isNaN(Date.parse(rawDate))) {
                res.status(400).json({ error: 'Formato data non valido. Usare YYYY-MM-DD.' });
                return;
            }
            date = rawDate;
        }
        else {
            date = new Date().toISOString().split('T')[0];
        }
        const nextDay = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];
        const actions = await (0, connection_1.dbTrack)('esiti')
            .where({ postino_id: postinoId })
            .where('data', '>=', date)
            .where('data', '<', nextDay)
            .whereNotNull('latitudine')
            .whereNotNull('longitudine')
            .where('latitudine', '!=', 0)
            .where('longitudine', '!=', 0)
            .orderBy('ora', 'asc')
            .select('barcode', 'esito', 'ora', 'latitudine', 'longitudine');
        res.json({ route: actions, date, postino_id: postinoId });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Postino route error', { error: err.message });
        res.status(500).json({ error: 'Errore nel recupero percorso' });
    }
}
//# sourceMappingURL=admin.controller.js.map