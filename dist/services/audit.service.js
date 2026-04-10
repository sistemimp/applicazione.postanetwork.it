"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const connection_1 = require("../db/connection");
// Ensure audit_trail table exists
let auditTableReady = false;
async function ensureAuditTable() {
    if (auditTableReady)
        return;
    const exists = await connection_1.dbTrack.schema.hasTable('audit_trail');
    if (!exists) {
        await connection_1.dbTrack.schema.createTable('audit_trail', (table) => {
            table.increments('id').primary();
            table.string('entity_type', 50).notNullable();
            table.integer('entity_id').unsigned().notNullable();
            table.string('campo', 100).notNullable();
            table.text('valore_precedente');
            table.text('valore_nuovo');
            table.integer('postino_id').unsigned().notNullable();
            table.string('motivo', 500);
            table.timestamp('created_at').defaultTo(connection_1.dbTrack.fn.now());
            table.index(['entity_type', 'entity_id'], 'idx_audit_entity');
        });
    }
    auditTableReady = true;
}
class AuditService {
    async logChange(data) {
        await ensureAuditTable();
        await (0, connection_1.dbTrack)('audit_trail').insert({
            ...data,
            created_at: new Date(),
        });
    }
    async getHistory(entityType, entityId) {
        await ensureAuditTable();
        return (0, connection_1.dbTrack)('audit_trail')
            .where({ entity_type: entityType, entity_id: entityId })
            .orderBy('created_at', 'desc');
    }
}
exports.AuditService = AuditService;
//# sourceMappingURL=audit.service.js.map