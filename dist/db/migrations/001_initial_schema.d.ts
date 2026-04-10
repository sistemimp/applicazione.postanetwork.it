import { Knex } from 'knex';
/**
 * Migration 001: Initial schema for all tables.
 * Creates tables if they don't exist (safe to run on existing DBs).
 */
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=001_initial_schema.d.ts.map