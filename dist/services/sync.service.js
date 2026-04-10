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
exports.SyncService = void 0;
const connection_1 = require("../db/connection");
const deliveries_service_1 = require("./deliveries.service");
const notes_service_1 = require("./notes.service");
const logger_1 = require("../utils/logger");
const validators_1 = require("../utils/validators");
// M2: Max 2MB decoded for base64 fields
const MAX_BASE64_DECODED_BYTES = 2 * 1024 * 1024;
function validateBase64Size(value, fieldName) {
    if (!value)
        return;
    const base64Part = value.includes(',') ? value.split(',')[1] : value;
    if (!base64Part)
        return;
    const decodedSize = Math.ceil((base64Part.length * 3) / 4);
    if (decodedSize > MAX_BASE64_DECODED_BYTES) {
        throw new Error(`${fieldName} troppo grande: ${(decodedSize / 1024 / 1024).toFixed(1)}MB, massimo 2MB`);
    }
}
const deliveriesService = new deliveries_service_1.DeliveriesService();
const notesService = new notes_service_1.NotesService();
// Run at most `limit` async tasks concurrently from `tasks`.
// Each task is a factory () => Promise<T> so work starts lazily.
async function runConcurrent(tasks, limit) {
    const results = new Array(tasks.length);
    let next = 0;
    async function worker() {
        while (next < tasks.length) {
            const idx = next++;
            try {
                results[idx] = await tasks[idx]();
            }
            catch (err) {
                results[idx] = err instanceof Error ? err : new Error(String(err));
            }
        }
    }
    const workers = [];
    for (let w = 0; w < Math.min(limit, tasks.length); w++) {
        workers.push(worker());
    }
    await Promise.all(workers);
    return results;
}
class SyncService {
    async getShiftData(postinoId) {
        const deliveries = await deliveriesService.getToday(postinoId);
        const notes = await (0, connection_1.dbTrack)('note_recapito')
            .where({ postino_id: postinoId })
            .orderBy('data', 'desc')
            .limit(500);
        const config = await (0, connection_1.dbTrack)('app_config').select('chiave', 'valore');
        return { deliveries, notes, config };
    }
    async processBatchSync(postinoId, items) {
        let processed = 0;
        const errors = [];
        // Limit batch size to prevent abuse
        if (items.length > 200) {
            return { processed: 0, errors: [{ index: 0, error: 'Batch troppo grande (max 200 items)' }] };
        }
        const validTipi = ['esito', 'nota', 'correzione', 'foto', 'firma', 'posizione'];
        // --- Pass 1: validate and group items by tipo ---
        // posizione: accumulate valid rows for a single batch INSERT
        const posizioneRows = [];
        const posizioneIndices = [];
        const esitoTasks = [];
        const otherItems = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // M3: Validate batch item tipo is a known type
            if (!validTipi.includes(item.tipo)) {
                errors.push({ index: i, error: `Tipo sconosciuto: ${item.tipo}` });
                continue;
            }
            if (item.tipo === 'posizione') {
                // M3: Validate coordinates for position updates
                const posPayload = item.payload;
                if (!(0, validators_1.isValidCoordinates)(posPayload.latitudine, posPayload.longitudine)) {
                    errors.push({ index: i, error: 'Coordinate posizione non valide' });
                    continue;
                }
                posizioneRows.push({
                    postino_id: postinoId,
                    latitudine: posPayload.latitudine,
                    longitudine: posPayload.longitudine,
                    timestamp: new Date(item.timestamp),
                    from_offline: true,
                });
                posizioneIndices.push(i);
                continue;
            }
            if (item.tipo === 'esito') {
                // M3: Validate esito payload with same rigor as direct API
                const esitoPayload = item.payload;
                if (!esitoPayload.barcode || typeof esitoPayload.barcode !== 'string') {
                    errors.push({ index: i, error: 'Barcode mancante o non valido' });
                    continue;
                }
                const sanitizedBarcode = (0, validators_1.sanitizeBarcode)(esitoPayload.barcode);
                if (sanitizedBarcode.length < 3 || sanitizedBarcode.length > 100) {
                    errors.push({ index: i, error: 'Barcode lunghezza non valida (3-100)' });
                    continue;
                }
                if (!esitoPayload.esito || typeof esitoPayload.esito !== 'string') {
                    errors.push({ index: i, error: 'Esito mancante' });
                    continue;
                }
                // M3: Validate coordinates if provided
                if (esitoPayload.latitudine !== undefined && esitoPayload.longitudine !== undefined) {
                    if (!(0, validators_1.isValidCoordinates)(esitoPayload.latitudine, esitoPayload.longitudine)) {
                        errors.push({ index: i, error: 'Coordinate non valide' });
                        continue;
                    }
                }
                // M3: Whitelist allowed fields for esito
                const allowedEsitoFields = ['barcode', 'esito', 'data', 'ora', 'latitudine', 'longitudine', 'note', 'firma_path', 'firma_base64', 'foto_base64', 'reso_motivo'];
                const cleanEsitoPayload = {};
                for (const key of allowedEsitoFields) {
                    if (esitoPayload[key] !== undefined)
                        cleanEsitoPayload[key] = esitoPayload[key];
                }
                cleanEsitoPayload.barcode = sanitizedBarcode;
                const capturedPayload = cleanEsitoPayload;
                esitoTasks.push({
                    index: i,
                    factory: async () => {
                        await deliveriesService.registerOutcome({
                            ...capturedPayload,
                            postino_id: postinoId,
                            created_offline: true,
                        });
                    },
                });
                continue;
            }
            // nota, correzione, foto, firma — sequential
            otherItems.push({ index: i, item });
        }
        // --- Pass 2: batch INSERT all valid posizione rows ---
        if (posizioneRows.length > 0) {
            try {
                await (0, connection_1.dbTrack)('geolocation_log').insert(posizioneRows);
                processed += posizioneRows.length;
            }
            catch (err) {
                // If the bulk insert fails, record each index as errored
                for (const idx of posizioneIndices) {
                    errors.push({ index: idx, error: err.message });
                }
            }
        }
        // --- Pass 3: run esito tasks concurrently (max 5 at a time) ---
        if (esitoTasks.length > 0) {
            const results = await runConcurrent(esitoTasks.map(t => t.factory), 5);
            for (let r = 0; r < results.length; r++) {
                if (results[r] instanceof Error) {
                    errors.push({ index: esitoTasks[r].index, error: results[r].message });
                }
                else {
                    processed++;
                }
            }
        }
        // --- Pass 4: process remaining item types sequentially ---
        for (const { index: i, item } of otherItems) {
            try {
                switch (item.tipo) {
                    case 'nota':
                        await notesService.create({
                            ...item.payload,
                            postino_id: postinoId,
                        });
                        break;
                    case 'correzione': {
                        const { entity_id, barcode, esito, motivo } = item.payload;
                        // M3: Validate correction payload
                        if (!esito || typeof esito !== 'string') {
                            errors.push({ index: i, error: 'Esito mancante per correzione' });
                            continue;
                        }
                        if (barcode && typeof barcode === 'string') {
                            const safeCorrBarcode = (0, validators_1.sanitizeBarcode)(barcode);
                            const { CorrectionsService } = await Promise.resolve().then(() => __importStar(require('./corrections.service')));
                            const correctionsService = new CorrectionsService();
                            await correctionsService.selfCorrectByBarcode(safeCorrBarcode, esito, postinoId);
                        }
                        else if (entity_id && typeof entity_id === 'number') {
                            const { CorrectionsService } = await Promise.resolve().then(() => __importStar(require('./corrections.service')));
                            const correctionsService = new CorrectionsService();
                            await correctionsService.updateOutcome(entity_id, esito, postinoId, motivo || '');
                        }
                        else {
                            errors.push({ index: i, error: 'Correzione: barcode o entity_id richiesto' });
                            continue;
                        }
                        break;
                    }
                    case 'foto': {
                        const fotoPayload = item.payload;
                        if (fotoPayload.foto_base64 && fotoPayload.barcode) {
                            // M2: Validate foto size
                            validateBase64Size(fotoPayload.foto_base64, 'foto_base64');
                            const safeFotoBarcode = (0, validators_1.sanitizeBarcode)(fotoPayload.barcode);
                            // Save Base64 photo directly to esiti table
                            const latestEsito = await (0, connection_1.dbTrack)('esiti')
                                .where({ barcode: safeFotoBarcode })
                                .orderBy('data', 'desc')
                                .orderBy('ora', 'desc')
                                .first();
                            if (latestEsito) {
                                await (0, connection_1.dbTrack)('esiti').where({ id: latestEsito.id }).update({ foto_base64: fotoPayload.foto_base64 });
                                (0, logger_1.log)('info', 'Foto synced from queue', { barcode: safeFotoBarcode });
                            }
                            else {
                                (0, logger_1.log)('warn', 'No esito found for foto sync', { barcode: safeFotoBarcode });
                            }
                        }
                        else if (fotoPayload.photoUri) {
                            // Old format with local file path — can't read phone file from server, skip
                            (0, logger_1.log)('info', 'Skipping foto with photoUri (old format)', { barcode: fotoPayload.barcode });
                        }
                        break;
                    }
                    case 'firma': {
                        const firmaPayload = item.payload;
                        if (firmaPayload.firmaBase64 && firmaPayload.barcode) {
                            // M2: Validate firma size
                            validateBase64Size(firmaPayload.firmaBase64, 'firma_base64');
                            const safeFirmaBarcode = (0, validators_1.sanitizeBarcode)(firmaPayload.barcode);
                            const latestEsito = await (0, connection_1.dbTrack)('esiti')
                                .where({ barcode: safeFirmaBarcode })
                                .orderBy('data', 'desc')
                                .orderBy('ora', 'desc')
                                .first();
                            if (latestEsito) {
                                const firmaData = firmaPayload.firmaBase64.startsWith('data:')
                                    ? firmaPayload.firmaBase64
                                    : 'data:image/png;base64,' + firmaPayload.firmaBase64;
                                await (0, connection_1.dbTrack)('esiti').where({ id: latestEsito.id }).update({ firma_base64: firmaData });
                                (0, logger_1.log)('info', 'Firma synced from queue', { barcode: safeFirmaBarcode });
                            }
                            else {
                                (0, logger_1.log)('warn', 'No esito found for firma sync', { barcode: safeFirmaBarcode });
                            }
                        }
                        break;
                    }
                }
                processed++;
            }
            catch (err) {
                errors.push({ index: i, error: err.message });
            }
        }
        (0, logger_1.log)('info', 'Batch sync completed', { postinoId, processed, errors: errors.length });
        return { processed, errors };
    }
    async getDeltaUpdates(postinoId, since) {
        // Exclude foto_base64 from delta sync (too heavy for bulk responses)
        const newOutcomes = await (0, connection_1.dbTrack)('esiti')
            .where('data', '>=', since)
            .where('postino_id', postinoId)
            .select('id', 'barcode', 'esito', 'data', 'ora', 'latitudine', 'longitudine', 'postino_id', 'note', 'firma_path', 'created_offline', 'synced_at', 'created_at');
        const newNotes = await (0, connection_1.dbTrack)('note_recapito')
            .where('data', '>=', since)
            .where('postino_id', postinoId)
            .select('*');
        return { outcomes: newOutcomes, notes: newNotes, timestamp: new Date() };
    }
}
exports.SyncService = SyncService;
//# sourceMappingURL=sync.service.js.map