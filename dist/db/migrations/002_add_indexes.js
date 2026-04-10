"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
/**
 * Migration 002: Add missing indexes for performance.
 * DH3: esiti.barcode, esiti.postino_id, esiti.data, audit_trail.entity_id
 * These are created IF NOT EXISTS via safe checks.
 */
async function up(knex) {
    // Helper: check if index exists (MySQL/TiDB compatible)
    async function hasIndex(table, indexName) {
        try {
            const [rows] = await knex.raw(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);
            return rows.length > 0;
        }
        catch {
            return false;
        }
    }
    // DH3: esiti indexes (may already exist from setup-tidb.js)
    if (await knex.schema.hasTable('esiti')) {
        if (!(await hasIndex('esiti', 'idx_esiti_barcode'))) {
            await knex.schema.alterTable('esiti', (t) => t.index('barcode', 'idx_esiti_barcode'));
        }
        if (!(await hasIndex('esiti', 'idx_esiti_postino'))) {
            await knex.schema.alterTable('esiti', (t) => t.index('postino_id', 'idx_esiti_postino'));
        }
        if (!(await hasIndex('esiti', 'idx_esiti_data'))) {
            await knex.schema.alterTable('esiti', (t) => t.index('data', 'idx_esiti_data'));
        }
    }
    // DH3: audit_trail.entity_id index
    if (await knex.schema.hasTable('audit_trail')) {
        if (!(await hasIndex('audit_trail', 'idx_audit_entity_id'))) {
            await knex.schema.alterTable('audit_trail', (t) => t.index('entity_id', 'idx_audit_entity_id'));
        }
    }
    // Additional useful indexes for failed_cross_db_updates (DC2)
    if (await knex.schema.hasTable('failed_cross_db_updates')) {
        if (!(await hasIndex('failed_cross_db_updates', 'idx_fcdu_resolved'))) {
            await knex.schema.alterTable('failed_cross_db_updates', (t) => t.index(['resolved', 'created_at'], 'idx_fcdu_resolved'));
        }
    }
}
async function down(knex) {
    // Dropping indexes is generally safe but we don't remove the base ones
    // as they may have been created by the initial setup
}
//# sourceMappingURL=002_add_indexes.js.map