"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiacenzaService = void 0;
const connection_1 = require("../db/connection");
const logger_1 = require("../utils/logger");
class GiacenzaService {
    async addToGiacenza(data) {
        const existing = await (0, connection_1.dbTrack)('giacenze').where({ barcode: data.barcode }).first();
        if (existing) {
            await (0, connection_1.dbTrack)('giacenze').where({ barcode: data.barcode }).update({
                scaffale: data.scaffale,
                contenitore: data.contenitore,
                numero_posizione: data.numero_posizione,
                stato: 'attiva',
                data_giacenza: new Date(),
            });
            (0, logger_1.log)('info', 'Giacenza updated', { barcode: data.barcode });
            return existing.id;
        }
        const [id] = await (0, connection_1.dbTrack)('giacenze').insert({
            barcode: data.barcode,
            scaffale: data.scaffale,
            contenitore: data.contenitore,
            numero_posizione: data.numero_posizione,
            stato: 'attiva',
            data_giacenza: new Date(),
        });
        (0, logger_1.log)('info', 'Added to giacenza', { barcode: data.barcode });
        return id;
    }
    async findByBarcode(barcode) {
        return (0, connection_1.dbTrack)('giacenze')
            .where({ barcode, stato: 'attiva' })
            .first();
    }
    async markAsRetrieved(barcode, gestoreId) {
        await (0, connection_1.dbTrack)('giacenze')
            .where({ barcode, stato: 'attiva' })
            .update({
            stato: 'ritirata',
            data_ritiro: new Date(),
        });
        await (0, connection_1.dbTrack)('esiti')
            .where({ barcode, esito: 'in giacenza' })
            .orderBy('data', 'desc')
            .limit(1)
            .update({ esito: 'ritirato da giacenza' });
        (0, logger_1.log)('info', 'Giacenza retrieved', { barcode, gestoreId });
    }
}
exports.GiacenzaService = GiacenzaService;
//# sourceMappingURL=giacenza.service.js.map