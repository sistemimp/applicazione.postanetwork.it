"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveriesService = void 0;
exports.retryFailedCrossDbUpdates = retryFailedCrossDbUpdates;
const connection_1 = require("../db/connection");
const logger_1 = require("../utils/logger");
const validators_1 = require("../utils/validators");
const ESITO_TO_CODE = {
    'consegnato': 'c',
    'in giacenza': 'g',
    'rifiutato': 'r',
    'd.sconosciuto': 's',
    'sconosciuto': 's',
    'indirizzo errato': 'e',
    'trasferito': 't',
    'deceduto': 'd',
    'fine attività': 'f',
    'fine attivita': 'f',
    'non ho rinvenuto il nominativo': 'o',
    'impossibile accedere a cassette': 'l',
    'info negative destinatario': 'n',
    'poste': 'p',
    'altro': 'a',
    'fine giacenza': 'z',
};
function mapEsitoToCode(esito) {
    return ESITO_TO_CODE[esito.toLowerCase()] || 'a'; // fallback to 'altro'
}
let columnsEnsured = false;
let failedUpdatesTableEnsured = false;
// DC2: Ensure table for tracking cross-DB update failures
async function ensureFailedUpdatesTable() {
    if (failedUpdatesTableEnsured)
        return;
    const exists = await connection_1.dbTrack.schema.hasTable('failed_cross_db_updates');
    if (!exists) {
        await connection_1.dbTrack.schema.createTable('failed_cross_db_updates', (table) => {
            table.increments('id').primary();
            table.string('barcode', 100).notNullable();
            table.integer('esito_id').unsigned().notNullable();
            table.string('target_table', 100).notNullable();
            table.string('target_field', 100).notNullable();
            table.string('target_value', 255).notNullable();
            table.text('error_message');
            table.integer('retry_count').defaultTo(0);
            table.boolean('resolved').defaultTo(false);
            table.timestamp('resolved_at').nullable();
            table.timestamp('created_at').defaultTo(connection_1.dbTrack.fn.now());
            table.index(['resolved', 'created_at']);
        });
        (0, logger_1.log)('info', 'Created failed_cross_db_updates table for compensation tracking');
    }
    failedUpdatesTableEnsured = true;
}
// DC2: Retry failed cross-DB updates
async function retryFailedCrossDbUpdates() {
    await ensureFailedUpdatesTable();
    const failures = await (0, connection_1.dbTrack)('failed_cross_db_updates')
        .where({ resolved: false })
        .where('retry_count', '<', 5)
        .orderBy('created_at', 'asc')
        .limit(100);
    let retried = 0;
    let failed = 0;
    let resolved = 0;
    for (const f of failures) {
        try {
            if (f.target_table === 'spedizioni' && f.target_field === 'stato') {
                await (0, connection_1.dbSpedizioni)('spedizioni')
                    .where({ barcode: f.barcode })
                    .update({ stato: f.target_value });
            }
            else if (f.target_table === 'external_db' && f.target_field === 'esito') {
                // Retry external DB sync
                await (0, connection_1.dbExternal)('db_spedizioni')
                    .where({ campo1: f.barcode })
                    .update({ esito: f.target_value, ultima_modifica: new Date() });
            }
            await (0, connection_1.dbTrack)('failed_cross_db_updates')
                .where({ id: f.id })
                .update({ resolved: true, resolved_at: new Date() });
            resolved++;
            retried++;
        }
        catch (err) {
            await (0, connection_1.dbTrack)('failed_cross_db_updates')
                .where({ id: f.id })
                .update({ retry_count: f.retry_count + 1, error_message: err.message });
            failed++;
            retried++;
        }
    }
    return { retried, failed, resolved };
}
async function ensureEsitiColumns() {
    if (columnsEnsured)
        return;
    const hasFirma = await connection_1.dbTrack.schema.hasColumn('esiti', 'firma_base64');
    if (!hasFirma) {
        await connection_1.dbTrack.schema.alterTable('esiti', (table) => { table.text('firma_base64').nullable(); });
        (0, logger_1.log)('info', 'Added firma_base64 column to esiti table');
    }
    const hasReso = await connection_1.dbTrack.schema.hasColumn('esiti', 'reso_motivo');
    if (!hasReso) {
        await connection_1.dbTrack.schema.alterTable('esiti', (table) => { table.string('reso_motivo', 255).nullable(); });
        (0, logger_1.log)('info', 'Added reso_motivo column to esiti table');
    }
    columnsEnsured = true;
}
// M2: Max 2MB decoded for base64 fields (foto_base64, firma_base64)
const MAX_BASE64_DECODED_BYTES = 2 * 1024 * 1024; // 2MB
function validateBase64Size(value, fieldName) {
    if (!value)
        return;
    // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Part = value.includes(',') ? value.split(',')[1] : value;
    if (!base64Part)
        return;
    // Base64 encodes 3 bytes per 4 chars; estimate decoded size
    const decodedSize = Math.ceil((base64Part.length * 3) / 4);
    if (decodedSize > MAX_BASE64_DECODED_BYTES) {
        throw new Error(`${fieldName} troppo grande: ${(decodedSize / 1024 / 1024).toFixed(1)}MB, massimo 2MB`);
    }
}
class DeliveriesService {
    async getToday(postinoId) {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        return (0, connection_1.dbSpedizioni)('spedizioni')
            .where({ postino_id: postinoId })
            .where('data_assegnazione', '>=', today)
            .where('data_assegnazione', '<', tomorrow)
            .select('*');
    }
    async registerOutcome(data) {
        await ensureEsitiColumns();
        // M2: Validate base64 field sizes before storing
        validateBase64Size(data.foto_base64, 'foto_base64');
        validateBase64Size(data.firma_base64, 'firma_base64');
        // Fix 1 & 6: Use client-provided date/time if available, otherwise server date
        const clientDate = data.data || new Date().toISOString().split('T')[0];
        const clientOra = data.ora || new Date().toTimeString().split(' ')[0];
        const today = new Date().toISOString().split('T')[0];
        // Determine the range to cover: whichever is earlier of today vs clientDate
        const rangeStart = clientDate < today ? clientDate : today;
        const rangeEnd = new Date(Math.max(new Date(clientDate).getTime(), new Date(today).getTime()) + 86400000).toISOString().split('T')[0];
        // If barcode already has an esito for this date, UPDATE it (stato change allowed)
        const id = await connection_1.dbTrack.transaction(async (trx) => {
            // Range query covers both server date and client date to catch cross-midnight cases
            const existing = await trx('esiti')
                .where({ barcode: data.barcode })
                .where('data', '>=', rangeStart)
                .where('data', '<', rangeEnd)
                .forUpdate()
                .first();
            const previousEsito = existing?.esito;
            if (existing) {
                // Always update — last action wins
                await trx('esiti').where({ id: existing.id }).update({
                    esito: data.esito,
                    ora: clientOra,
                    latitudine: data.latitudine || existing.latitudine,
                    longitudine: data.longitudine || existing.longitudine,
                    note: data.note || existing.note,
                    firma_path: data.firma_path || existing.firma_path,
                    firma_base64: data.firma_base64 || existing.firma_base64,
                    foto_base64: data.foto_base64 || existing.foto_base64,
                    reso_motivo: data.reso_motivo || existing.reso_motivo,
                    synced_at: new Date(),
                });
                (0, logger_1.log)('info', 'Esito aggiornato', { barcode: data.barcode, oldEsito: existing.esito, newEsito: data.esito });
                // Fix 7: If previous esito was "in giacenza" and new one is different, deactivate giacenza
                if (previousEsito && (previousEsito.toLowerCase() === 'in giacenza' || previousEsito.toLowerCase() === 'giacenza')
                    && data.esito.toLowerCase() !== 'in giacenza' && data.esito.toLowerCase() !== 'giacenza') {
                    try {
                        await trx('giacenze').where({ barcode: data.barcode }).update({ stato: 'risolta' });
                        (0, logger_1.log)('info', 'Giacenza risolta per cambio esito', { barcode: data.barcode, newEsito: data.esito });
                    }
                    catch (err) {
                        (0, logger_1.log)('warn', 'Failed to deactivate giacenza on esito change', { barcode: data.barcode, error: err.message });
                    }
                }
                return existing.id;
            }
            const [insertedId] = await trx('esiti').insert({
                barcode: data.barcode,
                esito: data.esito,
                data: clientDate,
                ora: clientOra,
                latitudine: data.latitudine || null,
                longitudine: data.longitudine || null,
                postino_id: data.postino_id,
                note: data.note || null,
                firma_path: data.firma_path || null,
                firma_base64: data.firma_base64 || null,
                foto_base64: data.foto_base64 || null,
                reso_motivo: data.reso_motivo || null,
                created_offline: data.created_offline || false,
                synced_at: data.created_offline ? new Date() : null,
            });
            return insertedId;
        });
        // Step 2: Update shipment status on dbSpedizioni (outside transaction — different DB)
        const esitoToStato = {
            consegnato: 'consegnata',
            rifiutato: 'rifiutata',
            assente: 'tentativo_fallito',
            sconosciuto: 'non_consegnata',
            'd.sconosciuto': 'non_consegnata',
            'indirizzo errato': 'non_consegnata',
            trasferito: 'non_consegnata',
            deceduto: 'non_consegnata',
            'deceduto/fine attivita': 'non_consegnata',
            'fine attività': 'non_consegnata',
            'fine attivita': 'non_consegnata',
            'non ho rinvenuto il nominativo': 'non_consegnata',
            'impossibile accedere a cassette': 'non_consegnata',
            'info negative destinatario': 'non_consegnata',
            poste: 'non_consegnata',
            altro: 'non_consegnata',
            'in giacenza': 'in_giacenza',
            giacenza: 'in_giacenza',
            'fine giacenza': 'consegnata',
            'lasciato in portineria': 'consegnata',
            'lasciato al vicino': 'consegnata',
            'reso al mittente': 'reso',
        };
        // Normalize esito: decode HTML entities and trim
        const normalizedEsito = data.esito.toLowerCase().replace(/&#x2f;|&#47;/gi, '/').trim();
        const nuovoStato = esitoToStato[normalizedEsito];
        if (!nuovoStato) {
            (0, logger_1.log)('warn', 'Esito non mappato a stato spedizione', { barcode: data.barcode, esito: data.esito });
        }
        if (nuovoStato) {
            try {
                await (0, connection_1.dbSpedizioni)('spedizioni')
                    .where({ barcode: data.barcode })
                    .update({ stato: nuovoStato });
            }
            catch (err) {
                // DC2: Log failure with enough info to retry, and persist to failed_cross_db_updates table
                const failurePayload = {
                    barcode: data.barcode,
                    esito_id: id,
                    target_stato: nuovoStato,
                    target_data_esito: data.data ? clientDate : new Date().toISOString().split('T')[0],
                    error_message: err.message,
                };
                (0, logger_1.log)('error', 'Cross-DB compensation needed: failed to update spedizioni stato', failurePayload);
                try {
                    await ensureFailedUpdatesTable();
                    await (0, connection_1.dbTrack)('failed_cross_db_updates').insert({
                        barcode: data.barcode,
                        esito_id: id,
                        target_table: 'spedizioni',
                        target_field: 'stato',
                        target_value: nuovoStato,
                        error_message: err.message,
                        retry_count: 0,
                        created_at: new Date(),
                    });
                }
                catch (logErr) {
                    (0, logger_1.log)('error', 'Failed to persist cross-DB failure record', { error: logErr.message });
                }
            }
        }
        // Step 3: If giacenza, also insert/update in giacenze table for admin panel
        if (data.esito.toLowerCase() === 'in giacenza' || data.esito.toLowerCase() === 'giacenza') {
            try {
                const existingGiacenza = await (0, connection_1.dbTrack)('giacenze').where({ barcode: data.barcode }).first();
                if (existingGiacenza) {
                    await (0, connection_1.dbTrack)('giacenze').where({ barcode: data.barcode }).update({
                        stato: 'attiva',
                        data_giacenza: data.data ? new Date(clientDate) : new Date(),
                    });
                }
                else {
                    await (0, connection_1.dbTrack)('giacenze').insert({
                        barcode: data.barcode,
                        postino_id: data.postino_id,
                        stato: 'attiva',
                        data_giacenza: data.data ? new Date(clientDate) : new Date(),
                    }).catch(() => {
                        // Table might not exist, try creating it
                    });
                }
            }
            catch (err) {
                (0, logger_1.log)('warn', 'Failed to update giacenze table', { barcode: data.barcode, error: err.message });
            }
        }
        // Step 4: Sync to external gestionale DB (fire-and-forget)
        if (process.env.EXTERNAL_SYNC_ENABLED === 'true') {
            const esitoCode = mapEsitoToCode(data.esito);
            try {
                // Get external user ID for this postino
                const postinoUser = await (0, connection_1.dbTrack)('users').where({ id: data.postino_id }).select('external_user_id').first();
                const externalUserId = postinoUser?.external_user_id || 0;
                // UPDATE db_spedizioni esito where campo1 = barcode
                await (0, connection_1.dbExternal)('db_spedizioni')
                    .where({ campo1: data.barcode })
                    .update({
                    esito: esitoCode,
                    postino: externalUserId,
                    data_consegna: new Date(),
                    ultima_modifica: new Date(),
                });
                // INSERT into db_tracciabilita
                const lavorazioneRow = await (0, connection_1.dbExternal)('db_spedizioni')
                    .where({ campo1: data.barcode })
                    .select('id_lavorazione')
                    .first();
                await (0, connection_1.dbExternal)('db_tracciabilita').insert({
                    id_lavorazione: lavorazioneRow?.id_lavorazione || '0',
                    barcode: data.barcode,
                    esito: esitoCode,
                    data_consegna: data.data ? new Date(clientDate) : new Date(),
                    data_ins: new Date().toISOString(),
                });
                (0, logger_1.log)('info', 'External DB synced', { barcode: data.barcode, esito: esitoCode });
            }
            catch (err) {
                (0, logger_1.log)('error', 'External DB sync failed — queued for retry', { barcode: data.barcode, error: err.message });
                try {
                    await (0, connection_1.dbTrack)('failed_cross_db_updates').insert({
                        barcode: data.barcode,
                        esito_id: id,
                        target_table: 'external_db',
                        target_field: 'esito',
                        target_value: esitoCode,
                        error_message: err.message,
                        retry_count: 0,
                        created_at: new Date(),
                    });
                }
                catch { /* compensation table insert failed — log only */ }
            }
        }
        (0, logger_1.log)('info', 'Outcome registered', { barcode: data.barcode, esito: data.esito, postinoId: data.postino_id });
        return id;
    }
    async checkPreviousOutcome(barcode) {
        return (0, connection_1.dbTrack)('esiti')
            .where({ barcode })
            .orderBy('data', 'desc')
            .first();
    }
    async getDailyHistory(postinoId, date) {
        // Fix 8: Accept optional date parameter instead of always using CURDATE()
        // Exclude foto_base64 from list queries (too heavy for bulk responses)
        const query = (0, connection_1.dbTrack)('esiti')
            .where({ postino_id: postinoId })
            .orderBy('data', 'desc')
            .orderBy('ora', 'desc')
            .select('id', 'barcode', 'esito', 'data', 'ora', 'latitudine', 'longitudine', 'postino_id', 'note', 'firma_path', 'created_offline', 'synced_at', 'created_at');
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const nextDay = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];
            query.where('data', '>=', date).where('data', '<', nextDay);
        }
        else {
            const todayStr = new Date().toISOString().split('T')[0];
            const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
            query.where('data', '>=', todayStr).where('data', '<', tomorrowStr);
        }
        return query;
    }
    async getOptimizedRoute(postinoId, currentLat, currentLng) {
        const deliveries = await (0, connection_1.dbSpedizioni)('spedizioni')
            .where({ postino_id: postinoId })
            .whereIn('stato', ['assegnata', 'da_lavorare'])
            .select('*');
        if (currentLat && currentLng) {
            // Sort by distance from current position
            deliveries.sort((a, b) => {
                const distA = Math.sqrt(Math.pow((a.latitudine || 0) - currentLat, 2) + Math.pow((a.longitudine || 0) - currentLng, 2));
                const distB = Math.sqrt(Math.pow((b.latitudine || 0) - currentLat, 2) + Math.pow((b.longitudine || 0) - currentLng, 2));
                return distA - distB;
            });
        }
        return deliveries;
    }
    async getZoneAssignment(postinoId) {
        const deliveries = await (0, connection_1.dbSpedizioni)('spedizioni')
            .where({ postino_id: postinoId })
            .whereIn('stato', ['assegnata', 'da_lavorare'])
            .select('comune');
        const comuni = {};
        deliveries.forEach((d) => {
            comuni[d.comune] = (comuni[d.comune] || 0) + 1;
        });
        const topComune = Object.entries(comuni).sort((a, b) => b[1] - a[1])[0];
        return { zona: topComune ? topComune[0] : '', count: deliveries.length };
    }
    async getPieceCounts(postinoId) {
        const rows = await (0, connection_1.dbSpedizioni)('spedizioni')
            .where({ postino_id: postinoId })
            .whereIn('stato', ['assegnata', 'da_lavorare'])
            .select('tipo_posta')
            .count('* as count')
            .groupBy('tipo_posta');
        return rows.map((r) => ({ tipo_posta: r.tipo_posta, count: parseInt(r.count) }));
    }
    async searchFreeText(query, lat, lng, postinoId) {
        if (!query || query.length > 255)
            return [];
        const safeQuery = (0, validators_1.escapeLikeWildcards)(query);
        const results = await (0, connection_1.dbSpedizioni)('spedizioni')
            .where(function () {
            this.where('barcode', 'like', `%${safeQuery}%`)
                .orWhere('destinatario_nome', 'like', `%${safeQuery}%`)
                .orWhere('destinatario_cognome', 'like', `%${safeQuery}%`)
                .orWhere('indirizzo', 'like', `%${safeQuery}%`)
                .orWhere('comune', 'like', `%${safeQuery}%`);
        })
            .limit(20)
            .select('*');
        if (lat && lng) {
            results.forEach((r) => {
                if (r.latitudine && r.longitudine) {
                    const R = 6371000;
                    const dLat = (r.latitudine - lat) * Math.PI / 180;
                    const dLng = (r.longitudine - lng) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(r.latitudine * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
                    r.distanza = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                }
            });
            results.sort((a, b) => (a.distanza || 999999) - (b.distanza || 999999));
        }
        return results;
    }
}
exports.DeliveriesService = DeliveriesService;
//# sourceMappingURL=deliveries.service.js.map