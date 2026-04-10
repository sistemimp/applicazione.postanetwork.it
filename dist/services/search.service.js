"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const connection_1 = require("../db/connection");
const validators_1 = require("../utils/validators");
class SearchService {
    async searchByBarcode(barcode) {
        // Search in spedizioni first
        const spedizione = await (0, connection_1.dbSpedizioni)('spedizioni').where({ barcode }).first();
        // Also search in esiti (track DB) — barcode may exist there even without a spedizione record
        const esiti = await (0, connection_1.dbTrack)('esiti').where({ barcode }).orderBy('data', 'desc');
        // If neither found, try partial match
        if (!spedizione && esiti.length === 0) {
            // Try LIKE match for partial barcodes
            const safeBarcode = (0, validators_1.escapeLikeWildcards)(barcode);
            const partialSped = await (0, connection_1.dbSpedizioni)('spedizioni')
                .where('barcode', 'like', `%${safeBarcode}%`)
                .limit(1)
                .first();
            const partialEsiti = await (0, connection_1.dbTrack)('esiti')
                .where('barcode', 'like', `%${safeBarcode}%`)
                .orderBy('data', 'desc')
                .limit(10);
            if (!partialSped && partialEsiti.length === 0)
                return null;
            const note = await (0, connection_1.dbTrack)('note_recapito').where({ barcode: partialSped?.barcode || barcode }).orderBy('data', 'desc').catch(() => []);
            return { ...(partialSped || { barcode }), esiti: partialEsiti, note };
        }
        const note = await (0, connection_1.dbTrack)('note_recapito').where({ barcode }).orderBy('data', 'desc').catch(() => []);
        // If no spedizione but has esiti, return esiti data
        if (!spedizione) {
            const lastEsito = esiti[0];
            return {
                barcode,
                destinatario_nome: '',
                destinatario_cognome: '',
                indirizzo: '',
                civico: '',
                comune: '',
                cap: '',
                tipo_posta: '',
                latitudine: lastEsito?.latitudine,
                longitudine: lastEsito?.longitudine,
                esiti,
                note,
            };
        }
        return { ...spedizione, esiti, note };
    }
    async searchFreeText(query, lat, lng) {
        if (!query || query.length > 255)
            return [];
        const safeQuery = (0, validators_1.escapeLikeWildcards)(query);
        // Search in spedizioni
        let results = await (0, connection_1.dbSpedizioni)('spedizioni')
            .where('barcode', 'like', `%${safeQuery}%`)
            .orWhere('destinatario_nome', 'like', `%${safeQuery}%`)
            .orWhere('destinatario_cognome', 'like', `%${safeQuery}%`)
            .orWhere('indirizzo', 'like', `%${safeQuery}%`)
            .limit(50)
            .select('*');
        // If nothing in spedizioni, also search in esiti (barcodes that were scanned but may not have a spedizione record)
        if (results.length === 0) {
            const esitiResults = await (0, connection_1.dbTrack)('esiti')
                .where('barcode', 'like', `%${safeQuery}%`)
                .orderBy('data', 'desc')
                .limit(50)
                .select('id', 'barcode', 'esito', 'data', 'ora', 'latitudine', 'longitudine', 'postino_id', 'note', 'created_at');
            // Deduplicate by barcode (keep latest)
            const seen = new Set();
            for (const e of esitiResults) {
                if (!seen.has(e.barcode)) {
                    seen.add(e.barcode);
                    results.push({
                        barcode: e.barcode,
                        destinatario_nome: '',
                        destinatario_cognome: '',
                        indirizzo: '',
                        civico: '',
                        comune: '',
                        cap: '',
                        tipo_posta: '',
                        latitudine: e.latitudine,
                        longitudine: e.longitudine,
                        esito: e.esito,
                        data: e.data,
                        ora: e.ora,
                    });
                }
            }
        }
        if (lat && lng && results.length > 0) {
            results = results
                .filter((r) => r.latitudine && r.longitudine)
                .map((r) => ({
                ...r,
                distanza: this.haversine(lat, lng, r.latitudine, r.longitudine),
            }))
                .sort((a, b) => a.distanza - b.distanza);
        }
        return results;
    }
    haversine(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
exports.SearchService = SearchService;
//# sourceMappingURL=search.service.js.map