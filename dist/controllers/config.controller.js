"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.getFirmaPolicy = getFirmaPolicy;
const connection_1 = require("../db/connection");
// Default hardcoded — usati se il configuratore non ha salvato nulla
const DEFAULT_ESITI_SI = ['consegnato', 'in giacenza', 'rifiutato'];
const DEFAULT_ESITI_NO = ['d.sconosciuto', 'indirizzo errato', 'trasferito', 'deceduto', 'fine attività', 'non ho rinvenuto il nominativo', 'impossibile accedere a cassette', 'info negative destinatario', 'poste', 'altro', 'fine giacenza'];
async function getConfig(req, res) {
    try {
        // Leggi esiti_consegna dal configuratore (salvati in app_config con chiave 'esiti_consegna')
        let esitiSi = DEFAULT_ESITI_SI;
        let esitiNo = DEFAULT_ESITI_NO;
        try {
            const esitiRow = await (0, connection_1.dbTrack)('app_config').where({ chiave: 'esiti_consegna' }).first();
            if (esitiRow?.valore) {
                const esitiConfig = JSON.parse(esitiRow.valore);
                if (esitiConfig.positivi && esitiConfig.positivi.length > 0) {
                    esitiSi = esitiConfig.positivi.map((e) => e.nome.toLowerCase());
                }
                if (esitiConfig.negativi && esitiConfig.negativi.length > 0) {
                    esitiNo = esitiConfig.negativi.map((e) => e.nome.toLowerCase());
                }
            }
        }
        catch { /* configuratore non ancora usato — usa default */ }
        // Leggi modalita_rapida dal configuratore
        let modalitaRapida = false;
        try {
            const rapidaRow = await (0, connection_1.dbTrack)('app_config').where({ chiave: 'modalita_rapida' }).first();
            if (rapidaRow?.valore) {
                const rapidaConfig = JSON.parse(rapidaRow.valore);
                modalitaRapida = rapidaConfig.enabled === true;
            }
        }
        catch { /* non configurato — default false */ }
        // Leggi gps_config dal configuratore
        let gpsConfig = {
            superpower_saver: true,
            accuracy_tracking: 'low',
            interval_tracking: 120,
            distance_tracking: 200,
            accuracy_scan: 'high',
            timeout_scan: 8,
            cache_max_age: 60,
            accuracy_filter: 50,
        };
        try {
            const gpsRow = await (0, connection_1.dbTrack)('app_config').where({ chiave: 'gps_tracking' }).first();
            if (gpsRow?.valore) {
                const saved = JSON.parse(gpsRow.valore);
                if (saved.superpower_saver !== undefined) {
                    gpsConfig = {
                        superpower_saver: saved.superpower_saver === true,
                        accuracy_tracking: saved.accuracy_tracking || 'low',
                        interval_tracking: saved.interval_tracking || 120,
                        distance_tracking: saved.distance_tracking || 200,
                        accuracy_scan: saved.accuracy_scan || 'high',
                        timeout_scan: saved.timeout_scan || 8,
                        cache_max_age: saved.cache_max_age || 60,
                        accuracy_filter: saved.accuracy_filter || 50,
                    };
                }
            }
        }
        catch { /* non configurato — usa default */ }
        res.json({
            esiti_standard: {
                si: esitiSi,
                no: esitiNo,
            },
            modalita_rapida: modalitaRapida,
            gps_config: gpsConfig,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero configurazione' });
    }
}
async function getFirmaPolicy(req, res) {
    try {
        // Read firma_policy from app_config
        let firmaPolicyRow = null;
        try {
            const hasTable = await connection_1.dbTrack.schema.hasTable('app_config');
            if (hasTable) {
                firmaPolicyRow = await (0, connection_1.dbTrack)('app_config').where({ chiave: 'firma_policy' }).first();
            }
        }
        catch { /* table may not exist yet */ }
        let firmaPolicy = { global: 'optional', per_postino: {} };
        if (firmaPolicyRow?.valore) {
            try {
                firmaPolicy = { ...firmaPolicy, ...JSON.parse(firmaPolicyRow.valore) };
            }
            catch { }
        }
        // Read esiti_consegna for per_esito firma settings
        let esitiConsegna = null;
        try {
            const esitiRow = await (0, connection_1.dbTrack)('app_config').where({ chiave: 'esiti_consegna' }).first();
            if (esitiRow?.valore) {
                esitiConsegna = JSON.parse(esitiRow.valore);
            }
        }
        catch { }
        // Build per_esito map from esiti_consegna config
        const perEsito = {};
        if (esitiConsegna) {
            for (const tipo of ['positivi', 'negativi']) {
                const items = esitiConsegna[tipo] || [];
                for (const item of items) {
                    if (item.firma_obbligatoria) {
                        perEsito[item.nome.toLowerCase()] = 'required';
                    }
                    // If firma_obbligatoria is false, don't add to perEsito
                    // so the global policy (e.g. 'disabled') is respected
                }
            }
        }
        // Check per_postino override for this user
        const userId = req.user?.userId;
        let postinoOverride = null;
        if (userId && firmaPolicy.per_postino && firmaPolicy.per_postino[String(userId)]) {
            postinoOverride = firmaPolicy.per_postino[String(userId)];
        }
        // Also check firma_override column on user
        if (userId) {
            try {
                const hasCol = await connection_1.dbTrack.schema.hasColumn('users', 'firma_override');
                if (hasCol) {
                    const user = await (0, connection_1.dbTrack)('users').where({ id: userId }).select('firma_override').first();
                    if (user?.firma_override) {
                        postinoOverride = user.firma_override;
                    }
                }
            }
            catch { }
        }
        res.json({
            global: firmaPolicy.global || 'optional',
            per_esito: perEsito,
            per_postino: postinoOverride || null,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel recupero politica firma' });
    }
}
//# sourceMappingURL=config.controller.js.map