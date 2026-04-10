"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrectionsService = void 0;
const connection_1 = require("../db/connection");
const audit_service_1 = require("./audit.service");
const logger_1 = require("../utils/logger");
const auditService = new audit_service_1.AuditService();
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
    return ESITO_TO_CODE[esito.toLowerCase()] || 'a';
}
class CorrectionsService {
    validateEsito(esito) {
        if (!CorrectionsService.VALID_ESITI.includes(esito.toLowerCase())) {
            throw new Error('Esito non valido');
        }
    }
    // Sync giacenze table when esito changes to/from "in giacenza"
    async syncGiacenza(barcode, oldEsito, newEsito, postinoId) {
        try {
            const isNewGiacenza = (newEsito === 'in giacenza' || newEsito === 'giacenza');
            const wasGiacenza = (oldEsito === 'in giacenza' || oldEsito === 'giacenza');
            if (isNewGiacenza && !wasGiacenza) {
                // Changed TO giacenza — create record
                const existing = await (0, connection_1.dbTrack)('giacenze').where({ barcode }).first();
                if (existing) {
                    await (0, connection_1.dbTrack)('giacenze').where({ barcode }).update({ stato: 'attiva', postino_id: postinoId, data_giacenza: new Date(), data_ritiro: null });
                }
                else {
                    await (0, connection_1.dbTrack)('giacenze').insert({ barcode, stato: 'attiva', postino_id: postinoId, data_giacenza: new Date() });
                }
                (0, logger_1.log)('info', 'Giacenza created from correction', { barcode, postinoId });
            }
            else if (wasGiacenza && !isNewGiacenza) {
                // Changed FROM giacenza — close record
                await (0, connection_1.dbTrack)('giacenze').where({ barcode, stato: 'attiva' }).update({ stato: 'ritirata', data_ritiro: new Date() });
                (0, logger_1.log)('info', 'Giacenza closed from correction', { barcode, newEsito });
            }
        }
        catch (err) {
            (0, logger_1.log)('warn', 'syncGiacenza failed (non-critical)', { barcode, error: err.message });
        }
    }
    async updateOutcome(id, newEsito, postinoId, motivo) {
        this.validateEsito(newEsito);
        const existing = await (0, connection_1.dbTrack)('esiti').where({ id }).first();
        if (!existing) {
            throw new Error('Esito non trovato');
        }
        // Update esito FIRST (critical)
        await (0, connection_1.dbTrack)('esiti').where({ id }).update({ esito: newEsito });
        // Sync giacenza (critical)
        await this.syncGiacenza(existing.barcode, existing.esito, newEsito, postinoId);
        // Sync correction to external DB
        if (process.env.EXTERNAL_SYNC_ENABLED === 'true') {
            try {
                const esitoCode = mapEsitoToCode(newEsito);
                await (0, connection_1.dbExternal)('db_spedizioni')
                    .where({ campo1: existing.barcode })
                    .update({ esito: esitoCode, ultima_modifica: new Date() });
            }
            catch (err) {
                (0, logger_1.log)('warn', 'External DB correction sync failed', { barcode: existing.barcode, error: err.message });
            }
        }
        // Audit log (non-critical)
        try {
            await auditService.logChange({
                entity_type: 'esito',
                entity_id: id,
                campo: 'esito',
                valore_precedente: existing.esito,
                valore_nuovo: newEsito,
                postino_id: postinoId,
                motivo,
            });
        }
        catch (err) {
            (0, logger_1.log)('warn', 'Audit log failed (non-critical)', { error: err.message });
        }
        (0, logger_1.log)('info', 'Outcome corrected', { id, oldEsito: existing.esito, newEsito, postinoId });
    }
    async updateRecipientData(id, data, postinoId, motivo, userRole) {
        const existing = await (0, connection_1.dbSpedizioni)('spedizioni').where({ id }).first();
        if (!existing) {
            throw new Error('Spedizione non trovata');
        }
        // Postino can only correct their own shipments
        if (userRole === 'postino' && existing.postino_id !== postinoId) {
            throw new Error('Non autorizzato a modificare questa spedizione');
        }
        // Filter to only allowed fields to prevent field injection
        const safeData = {};
        for (const [campo, nuovoValore] of Object.entries(data)) {
            if (!CorrectionsService.ALLOWED_FIELDS.includes(campo)) {
                continue;
            }
            safeData[campo] = nuovoValore;
        }
        if (Object.keys(safeData).length === 0) {
            throw new Error('Nessun campo valido da aggiornare');
        }
        for (const [campo, nuovoValore] of Object.entries(safeData)) {
            if (existing[campo] !== nuovoValore) {
                await auditService.logChange({
                    entity_type: 'spedizione',
                    entity_id: id,
                    campo,
                    valore_precedente: existing[campo] || '',
                    valore_nuovo: nuovoValore,
                    postino_id: postinoId,
                    motivo,
                });
            }
        }
        await (0, connection_1.dbSpedizioni)('spedizioni').where({ id }).update(safeData);
    }
    async selfCorrectByBarcode(barcode, newEsito, postinoId) {
        this.validateEsito(newEsito);
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const existing = await (0, connection_1.dbTrack)('esiti')
            .where({ barcode, postino_id: postinoId })
            .where('data', '>=', todayStr)
            .where('data', '<', tomorrowStr)
            .orderBy('created_at', 'desc')
            .first();
        if (!existing) {
            // Debug: log what we searched for and what exists
            const allForBarcode = await (0, connection_1.dbTrack)('esiti').where({ barcode }).select('id', 'barcode', 'postino_id', 'data', 'esito');
            (0, logger_1.log)('error', 'selfCorrect: Esito non trovato', {
                searchCriteria: { barcode, postino_id: postinoId, todayStr },
                existingRecords: allForBarcode,
            });
            throw new Error(`Esito non trovato (barcode=${barcode}, postino_id=${postinoId}, data=${todayStr}, records=${allForBarcode.length})`);
        }
        // M9: Check correction limit — audit_trail table MUST exist; reject corrections if it doesn't
        try {
            const correctionCount = await (0, connection_1.dbTrack)('audit_trail')
                .where({ entity_type: 'esito', entity_id: existing.id, campo: 'esito' })
                .where('created_at', '>=', todayStr)
                .where('created_at', '<', tomorrowStr)
                .count('* as cnt')
                .first();
            if ((correctionCount?.cnt || 0) >= 5) {
                throw new Error('Limite correzioni raggiunto per questo pacco oggi (max 5)');
            }
        }
        catch (limitErr) {
            if (limitErr.message.includes('Limite correzioni'))
                throw limitErr;
            // M9: If audit_trail table doesn't exist, reject the correction
            (0, logger_1.log)('error', 'Audit trail table not available — corrections rejected', { error: limitErr.message });
            throw new Error('Audit trail non disponibile: correzioni non consentite senza tracciabilita\'. Contattare il supervisore.');
        }
        // Update the esito FIRST — this is the critical operation
        await (0, connection_1.dbTrack)('esiti').where({ id: existing.id }).update({ esito: newEsito });
        // Sync correction to external DB
        if (process.env.EXTERNAL_SYNC_ENABLED === 'true') {
            try {
                const esitoCode = mapEsitoToCode(newEsito);
                await (0, connection_1.dbExternal)('db_spedizioni')
                    .where({ campo1: barcode })
                    .update({ esito: esitoCode, ultima_modifica: new Date() });
            }
            catch (err) {
                (0, logger_1.log)('warn', 'External DB selfCorrect sync failed', { barcode, error: err.message });
            }
        }
        // Log audit (non-blocking — don't fail the correction if audit fails)
        try {
            await auditService.logChange({
                entity_type: 'esito',
                entity_id: existing.id,
                campo: 'esito',
                valore_precedente: existing.esito,
                valore_nuovo: newEsito,
                postino_id: postinoId,
                motivo: 'correzione postino',
            });
        }
        catch (auditErr) {
            (0, logger_1.log)('warn', 'Audit log failed (non-critical)', { error: auditErr.message });
        }
        await this.syncGiacenza(barcode, existing.esito, newEsito, postinoId);
        (0, logger_1.log)('info', 'Self-corrected outcome', { barcode, oldEsito: existing.esito, newEsito, postinoId });
    }
    async getAuditTrail(entityType, entityId) {
        return auditService.getHistory(entityType, entityId);
    }
}
exports.CorrectionsService = CorrectionsService;
CorrectionsService.VALID_ESITI = [
    'consegnato', 'in giacenza', 'rifiutato',
    'd.sconosciuto', 'sconosciuto', 'indirizzo errato', 'trasferito',
    'deceduto', 'fine attività', 'fine attivita',
    'non ho rinvenuto il nominativo', 'impossibile accedere a cassette',
    'info negative destinatario', 'poste', 'altro', 'fine giacenza',
    // Legacy values for backward compatibility
    'deceduto/fine attivita', 'lasciato in portineria', 'lasciato al vicino',
    'reso al mittente', 'assente',
];
CorrectionsService.ALLOWED_FIELDS = [
    'destinatario_nome', 'destinatario_cognome',
    'indirizzo', 'civico', 'cap', 'comune', 'provincia',
    'telefono', 'email', 'note',
];
//# sourceMappingURL=corrections.service.js.map