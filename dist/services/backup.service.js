"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = exportData;
exports.uploadToCloud = uploadToCloud;
exports.testCloudConnection = testCloudConnection;
exports.listCloudBackups = listCloudBackups;
exports.applyRetentionPolicy = applyRetentionPolicy;
exports.runScheduledBackup = runScheduledBackup;
exports.getBackupConfig = getBackupConfig;
exports.saveBackupConfig = saveBackupConfig;
const client_s3_1 = require("@aws-sdk/client-s3");
const googleapis_1 = require("googleapis");
const zlib_1 = require("zlib");
const stream_1 = require("stream");
const connection_1 = require("../db/connection");
const backup_config_1 = require("../config/backup.config");
const logger_1 = require("../utils/logger");
// ─── Google Drive helpers ───
function buildDriveClient(cfg) {
    const auth = new googleapis_1.google.auth.JWT({
        email: cfg.gdriveEmail,
        key: cfg.gdriveKey,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    return googleapis_1.google.drive({ version: 'v3', auth });
}
async function uploadToGDrive(data, filename, cfg) {
    const drive = buildDriveClient(cfg);
    const fileMetadata = {
        name: filename,
        mimeType: 'application/gzip',
    };
    if (cfg.gdriveFolderId) {
        fileMetadata.parents = [cfg.gdriveFolderId];
    }
    const media = {
        mimeType: 'application/gzip',
        body: stream_1.Readable.from(data),
    };
    await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id,name,size',
    });
    return { success: true, message: `Upload Google Drive completato: ${filename}`, size: data.length };
}
async function testGDriveConnection(cfg) {
    try {
        const drive = buildDriveClient(cfg);
        if (cfg.gdriveFolderId) {
            await drive.files.get({ fileId: cfg.gdriveFolderId, fields: 'id,name' });
            return { success: true, message: 'Connessione a Google Drive riuscita — cartella trovata' };
        }
        await drive.files.list({ pageSize: 1, fields: 'files(id)' });
        return { success: true, message: 'Connessione a Google Drive riuscita' };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto';
        return { success: false, message: `Connessione Google Drive fallita: ${message}` };
    }
}
async function listGDriveBackups(cfg) {
    const drive = buildDriveClient(cfg);
    let query = "name contains 'backup-' and mimeType = 'application/gzip' and trashed = false";
    if (cfg.gdriveFolderId) {
        query += ` and '${cfg.gdriveFolderId}' in parents`;
    }
    const res = await drive.files.list({
        q: query,
        fields: 'files(id,name,size,modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
    });
    return (res.data.files || []).map(f => ({
        name: f.name || '',
        size: parseInt(f.size || '0'),
        lastModified: f.modifiedTime || '',
        gdriveId: f.id,
    }));
}
async function applyGDriveRetention(cfg) {
    if (cfg.retention === 'unlimited')
        return { deleted: 0 };
    const maxBackups = Number(cfg.retention);
    if (isNaN(maxBackups) || maxBackups < 1)
        return { deleted: 0 };
    const backups = await listGDriveBackups(cfg);
    if (backups.length <= maxBackups)
        return { deleted: 0 };
    const drive = buildDriveClient(cfg);
    const toDelete = backups.slice(maxBackups);
    let deleted = 0;
    for (const b of toDelete) {
        try {
            await drive.files.delete({ fileId: b.gdriveId });
            deleted++;
        }
        catch (err) {
            (0, logger_1.log)('error', 'Failed to delete old GDrive backup', { name: b.name, error: err.message });
        }
    }
    return { deleted };
}
const PAGE_SIZE = 1000;
function buildS3Client(cfg) {
    return new client_s3_1.S3Client({
        endpoint: cfg.endpoint || undefined,
        region: cfg.region || 'auto',
        credentials: {
            accessKeyId: cfg.accessKeyId,
            secretAccessKey: cfg.secretAccessKey,
        },
        forcePathStyle: true,
    });
}
// ─── Paginated table reader ───
async function* readTablePaginated(db, table, columns, orderBy = 'id') {
    let offset = 0;
    while (true) {
        const rows = await db(table).select(columns).orderBy(orderBy, 'asc').limit(PAGE_SIZE).offset(offset);
        if (rows.length === 0)
            break;
        yield rows;
        if (rows.length < PAGE_SIZE)
            break;
        offset += PAGE_SIZE;
    }
}
// ─── Export Data ───
async function exportData(options) {
    const { includeFoto, includeFirma, format } = options;
    // Build column lists
    const userColumns = ['id', 'username', 'role', 'active', 'permissions', 'created_at'];
    const esitiColumnsBase = ['id', 'barcode', 'esito', 'data', 'ora', 'latitudine', 'longitudine', 'postino_id', 'note', 'created_at'];
    const esitiColumns = [...esitiColumnsBase];
    if (includeFoto)
        esitiColumns.push('foto_base64');
    if (includeFirma)
        esitiColumns.push('firma_base64');
    const tables = [
        { name: 'users', db: connection_1.dbTrack, columns: userColumns },
        { name: 'esiti', db: connection_1.dbTrack, columns: esitiColumns },
        { name: 'spedizioni', db: connection_1.dbSpedizioni, columns: ['*'] },
        { name: 'giacenze', db: connection_1.dbTrack, columns: ['*'] },
        { name: 'app_config', db: connection_1.dbTrack, columns: ['*'], orderBy: 'chiave' },
        { name: 'audit_trail', db: connection_1.dbTrack, columns: ['*'] },
    ];
    if (format === 'csv') {
        return exportCSV(tables);
    }
    return exportJSON(tables);
}
async function exportJSON(tables) {
    const data = {};
    const counts = {};
    for (const t of tables) {
        const allRows = [];
        try {
            for await (const page of readTablePaginated(t.db, t.name, t.columns, t.orderBy || 'id')) {
                allRows.push(...page);
            }
        }
        catch (err) {
            (0, logger_1.log)('warn', `Backup: table "${t.name}" skipped`, { error: err.message });
        }
        data[t.name] = allRows;
        counts[t.name] = allRows.length;
    }
    const backup = {
        metadata: {
            timestamp: new Date().toISOString(),
            version: '2.0',
            format: 'json',
        },
        counts,
        data,
    };
    const jsonStr = JSON.stringify(backup);
    const compressed = await gzipBuffer(Buffer.from(jsonStr, 'utf-8'));
    return { buffer: compressed, metadata: { counts, timestamp: backup.metadata.timestamp } };
}
async function exportCSV(tables) {
    const parts = [];
    const counts = {};
    for (const t of tables) {
        let tableRows = [];
        try {
            for await (const page of readTablePaginated(t.db, t.name, t.columns, t.orderBy || 'id')) {
                tableRows.push(...page);
            }
        }
        catch (err) {
            (0, logger_1.log)('warn', `Backup CSV: table "${t.name}" skipped`, { error: err.message });
        }
        counts[t.name] = tableRows.length;
        if (tableRows.length === 0)
            continue;
        parts.push(`\n### TABLE: ${t.name} ###\n`);
        const headers = Object.keys(tableRows[0]);
        parts.push(headers.map(csvEscape).join(','));
        for (const row of tableRows) {
            parts.push(headers.map(h => csvEscape(String(row[h] ?? ''))).join(','));
        }
        tableRows = []; // free memory
    }
    const csvStr = parts.join('\n');
    const compressed = await gzipBuffer(Buffer.from(csvStr, 'utf-8'));
    return { buffer: compressed, metadata: { counts, timestamp: new Date().toISOString() } };
}
function csvEscape(val) {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
}
function gzipBuffer(input) {
    return new Promise((resolve, reject) => {
        const gzip = (0, zlib_1.createGzip)();
        const chunks = [];
        const readable = new stream_1.Readable();
        readable.push(input);
        readable.push(null);
        readable.pipe(gzip)
            .on('data', (chunk) => chunks.push(chunk))
            .on('end', () => resolve(Buffer.concat(chunks)))
            .on('error', reject);
    });
}
// ─── Cloud Operations ───
async function uploadToCloud(data, filename, cfg) {
    if (cfg.provider === 'gdrive') {
        return uploadToGDrive(data, filename, cfg);
    }
    const client = buildS3Client(cfg);
    await client.send(new client_s3_1.PutObjectCommand({
        Bucket: cfg.bucket,
        Key: filename,
        Body: data,
        ContentType: 'application/gzip',
        ContentEncoding: 'gzip',
    }));
    return { success: true, message: `Upload completato: ${filename}`, size: data.length };
}
async function testCloudConnection(cfg) {
    if (cfg.provider === 'gdrive') {
        return testGDriveConnection(cfg);
    }
    try {
        const client = buildS3Client(cfg);
        await client.send(new client_s3_1.HeadBucketCommand({ Bucket: cfg.bucket }));
        return { success: true, message: 'Connessione al bucket riuscita' };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto';
        return { success: false, message: `Connessione fallita: ${message}` };
    }
}
async function listCloudBackups(cfg) {
    if (cfg.provider === 'gdrive') {
        return listGDriveBackups(cfg);
    }
    const client = buildS3Client(cfg);
    const result = await client.send(new client_s3_1.ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: 'backup-',
    }));
    if (!result.Contents)
        return [];
    return result.Contents
        .filter(obj => obj.Key && obj.Key.startsWith('backup-'))
        .map(obj => ({
        name: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified?.toISOString() || '',
    }))
        .sort((a, b) => b.lastModified.localeCompare(a.lastModified));
}
async function applyRetentionPolicy(cfg) {
    if (cfg.retention === 'unlimited')
        return { deleted: 0 };
    if (cfg.provider === 'gdrive') {
        return applyGDriveRetention(cfg);
    }
    const maxBackups = Number(cfg.retention);
    if (isNaN(maxBackups) || maxBackups < 1)
        return { deleted: 0 };
    const backups = await listCloudBackups(cfg);
    if (backups.length <= maxBackups)
        return { deleted: 0 };
    const toDelete = backups.slice(maxBackups);
    const client = buildS3Client(cfg);
    let deleted = 0;
    for (const backup of toDelete) {
        try {
            await client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: cfg.bucket,
                Key: backup.name,
            }));
            deleted++;
        }
        catch (err) {
            (0, logger_1.log)('error', 'Failed to delete old backup', { key: backup.name, error: err.message });
        }
    }
    return { deleted };
}
// ─── Scheduled Backup ───
async function runScheduledBackup() {
    const cfg = await getBackupConfig();
    if (!cfg) {
        return { success: false, message: 'Nessuna configurazione cloud trovata' };
    }
    if (cfg.provider === 'gdrive') {
        if (!cfg.gdriveEmail || !cfg.gdriveKey) {
            return { success: false, message: 'Configurazione Google Drive incompleta (email e chiave richieste)' };
        }
    }
    else {
        if (!cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey || !cfg.bucket) {
            return { success: false, message: 'Configurazione cloud incompleta' };
        }
    }
    const startTime = Date.now();
    (0, logger_1.log)('info', 'Scheduled backup started');
    try {
        const { buffer, metadata } = await exportData({
            includeFoto: cfg.includeFoto || false,
            includeFirma: cfg.includeFirma || false,
            format: 'json',
        });
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const filename = `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json.gz`;
        const uploadResult = await uploadToCloud(buffer, filename, cfg);
        // Apply retention
        const retentionResult = await applyRetentionPolicy(cfg);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        (0, logger_1.log)('info', 'Scheduled backup completed', {
            filename,
            sizeBytes: buffer.length,
            elapsed: `${elapsed}s`,
            deletedOld: retentionResult.deleted,
            counts: metadata.counts,
        });
        return {
            success: true,
            message: `Backup completato in ${elapsed}s`,
            filename,
            size: buffer.length,
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto';
        (0, logger_1.log)('error', 'Scheduled backup failed', { error: message });
        return { success: false, message: `Backup fallito: ${message}` };
    }
}
// ─── Config persistence ───
async function getBackupConfig() {
    try {
        const row = await (0, connection_1.dbTrack)('app_config')
            .where('chiave', 'backup_cloud_config')
            .first();
        if (!row)
            return null;
        const parsed = JSON.parse(row.valore);
        return { ...backup_config_1.DEFAULT_BACKUP_CONFIG, ...parsed };
    }
    catch {
        return null;
    }
}
async function saveBackupConfig(cfg) {
    const validation = (0, backup_config_1.validateBackupConfig)(cfg);
    if (!validation.valid) {
        return { success: false, errors: validation.errors };
    }
    const existing = await getBackupConfig();
    const merged = { ...(existing || backup_config_1.DEFAULT_BACKUP_CONFIG), ...cfg };
    const jsonValue = JSON.stringify(merged);
    const row = await (0, connection_1.dbTrack)('app_config').where('chiave', 'backup_cloud_config').first();
    if (row) {
        await (0, connection_1.dbTrack)('app_config').where('chiave', 'backup_cloud_config').update({
            valore: jsonValue,
            updated_at: connection_1.dbTrack.fn.now(),
        });
    }
    else {
        await (0, connection_1.dbTrack)('app_config').insert({
            chiave: 'backup_cloud_config',
            valore: jsonValue,
            updated_at: connection_1.dbTrack.fn.now(),
        });
    }
    return { success: true };
}
//# sourceMappingURL=backup.service.js.map