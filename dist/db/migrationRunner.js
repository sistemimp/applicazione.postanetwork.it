"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const logger_1 = require("../utils/logger");
// Registry of all migrations in order
const MIGRATIONS = [
    { name: '001_initial_schema', load: () => Promise.resolve().then(() => __importStar(require('./migrations/001_initial_schema'))) },
    { name: '002_add_indexes', load: () => Promise.resolve().then(() => __importStar(require('./migrations/002_add_indexes'))) },
];
async function ensureMigrationsTable(knex) {
    const exists = await knex.schema.hasTable('_migrations');
    if (!exists) {
        await knex.schema.createTable('_migrations', (t) => {
            t.increments('id').primary();
            t.string('name', 255).notNullable().unique();
            t.timestamp('applied_at').defaultTo(knex.fn.now());
        });
    }
}
async function runMigrations(knex) {
    try {
        await ensureMigrationsTable(knex);
        const applied = await knex('_migrations').select('name');
        const appliedSet = new Set(applied.map((r) => r.name));
        let count = 0;
        for (const migration of MIGRATIONS) {
            if (appliedSet.has(migration.name)) {
                continue;
            }
            (0, logger_1.log)('info', `Running migration: ${migration.name}`);
            try {
                const mod = await migration.load();
                await mod.up(knex);
                await knex('_migrations').insert({ name: migration.name });
                count++;
                (0, logger_1.log)('info', `Migration ${migration.name} applied successfully`);
            }
            catch (err) {
                (0, logger_1.log)('error', `Migration ${migration.name} failed`, { error: err.message });
                // Don't throw — log and continue so the server can still start
                // The migration may have partially applied (e.g., some tables already exist)
            }
        }
        if (count > 0) {
            (0, logger_1.log)('info', `Migrations complete: ${count} new migration(s) applied`);
        }
    }
    catch (err) {
        (0, logger_1.log)('error', 'Migration runner failed', { error: err.message });
    }
}
//# sourceMappingURL=migrationRunner.js.map