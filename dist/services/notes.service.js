"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotesService = void 0;
const connection_1 = require("../db/connection");
const logger_1 = require("../utils/logger");
const validators_1 = require("../utils/validators");
class NotesService {
    async create(data) {
        const [id] = await (0, connection_1.dbTrack)('note_recapito').insert(data);
        (0, logger_1.log)('info', 'Note created', { barcode: data.barcode, postinoId: data.postino_id });
        return id;
    }
    async getByBarcode(barcode) {
        return (0, connection_1.dbTrack)('note_recapito').where({ barcode }).orderBy('data', 'desc');
    }
    async searchByNameOrAddress(query) {
        if (!query || query.length > 255)
            return [];
        const safeQuery = (0, validators_1.escapeLikeWildcards)(query);
        return (0, connection_1.dbTrack)('note_recapito')
            .where('nome', 'like', `%${safeQuery}%`)
            .orWhere('cognome', 'like', `%${safeQuery}%`)
            .orWhere('indirizzo_originale', 'like', `%${safeQuery}%`)
            .orWhere('indirizzo_corretto', 'like', `%${safeQuery}%`)
            .orderBy('data', 'desc')
            .limit(50);
    }
    async checkExisting(barcode) {
        const note = await (0, connection_1.dbTrack)('note_recapito').where({ barcode }).first();
        return !!note;
    }
    async update(id, data) {
        await (0, connection_1.dbTrack)('note_recapito').where({ id }).update(data);
    }
}
exports.NotesService = NotesService;
//# sourceMappingURL=notes.service.js.map