import { Knex } from 'knex';
/**
 * Migration 002: Add missing indexes for performance.
 * DH3: esiti.barcode, esiti.postino_id, esiti.data, audit_trail.entity_id
 * These are created IF NOT EXISTS via safe checks.
 */
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=002_add_indexes.d.ts.map