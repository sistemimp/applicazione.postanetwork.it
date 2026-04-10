"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
/**
 * Migration 001: Initial schema for all tables.
 * Creates tables if they don't exist (safe to run on existing DBs).
 */
async function up(knex) {
    // --- Track DB tables ---
    if (!(await knex.schema.hasTable('users'))) {
        await knex.schema.createTable('users', (t) => {
            t.increments('id').primary();
            t.string('username', 100).notNullable().unique();
            t.string('password_hash', 255).notNullable();
            t.string('role', 50).notNullable().defaultTo('postino');
            t.boolean('active').defaultTo(true);
            t.integer('failed_attempts').defaultTo(0);
            t.timestamp('locked_until').nullable();
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.text('permissions').nullable();
            t.string('totp_secret', 255).nullable();
            t.boolean('totp_enabled').defaultTo(false);
            t.string('firma_override', 100).nullable();
            t.string('telefono', 50).nullable();
        });
    }
    if (!(await knex.schema.hasTable('esiti'))) {
        await knex.schema.createTable('esiti', (t) => {
            t.increments('id').primary();
            t.string('barcode', 100).notNullable();
            t.string('esito', 100).notNullable();
            t.date('data').notNullable();
            t.string('ora', 10).nullable();
            t.decimal('latitudine', 10, 8).nullable();
            t.decimal('longitudine', 11, 8).nullable();
            t.integer('postino_id').unsigned().notNullable();
            t.text('note').nullable();
            t.string('firma_path', 500).nullable();
            t.text('foto_base64').nullable();
            t.boolean('created_offline').defaultTo(false);
            t.timestamp('synced_at').nullable();
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.index('barcode', 'idx_esiti_barcode');
            t.index('postino_id', 'idx_esiti_postino');
            t.index('data', 'idx_esiti_data');
            t.index(['postino_id', 'data'], 'idx_esiti_postino_data');
        });
    }
    if (!(await knex.schema.hasTable('note_recapito'))) {
        await knex.schema.createTable('note_recapito', (t) => {
            t.increments('id').primary();
            t.string('barcode', 100).notNullable();
            t.date('data').notNullable();
            t.string('nome', 200).nullable();
            t.string('cognome', 200).nullable();
            t.string('indirizzo_originale', 300).nullable();
            t.string('civico_originale', 20).nullable();
            t.string('subcivico_originale', 20).nullable();
            t.string('indirizzo_corretto', 300).nullable();
            t.string('civico_corretto', 20).nullable();
            t.string('subcivico_corretto', 20).nullable();
            t.text('nota').nullable();
            t.string('categoria', 100).nullable();
            t.string('foto_path', 500).nullable();
            t.decimal('latitudine', 10, 8).nullable();
            t.decimal('longitudine', 11, 8).nullable();
            t.integer('postino_id').unsigned().notNullable();
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.index('barcode', 'idx_note_recapito_barcode');
        });
    }
    if (!(await knex.schema.hasTable('geolocation_log'))) {
        await knex.schema.createTable('geolocation_log', (t) => {
            t.increments('id').primary();
            t.integer('postino_id').unsigned().notNullable();
            t.decimal('latitudine', 10, 8).notNullable();
            t.decimal('longitudine', 11, 8).notNullable();
            t.timestamp('timestamp').defaultTo(knex.fn.now());
            t.boolean('from_offline').defaultTo(false);
            t.index(['postino_id', 'timestamp'], 'idx_geo_postino_ts');
        });
    }
    if (!(await knex.schema.hasTable('devices'))) {
        await knex.schema.createTable('devices', (t) => {
            t.increments('id').primary();
            t.integer('user_id').unsigned().notNullable();
            t.string('device_id', 100).notNullable().unique();
            t.string('device_name', 200).nullable();
            t.string('platform', 20).nullable();
            t.boolean('blocked').defaultTo(false);
            t.timestamp('last_seen').defaultTo(knex.fn.now());
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.index('user_id', 'idx_devices_user');
        });
    }
    if (!(await knex.schema.hasTable('refresh_tokens'))) {
        await knex.schema.createTable('refresh_tokens', (t) => {
            t.increments('id').primary();
            t.integer('user_id').unsigned().notNullable();
            t.string('token', 500).notNullable();
            t.string('device_id', 100).nullable();
            t.timestamp('expires_at').notNullable();
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.index('user_id', 'idx_rt_user');
            t.index('token', 'idx_rt_token');
        });
    }
    if (!(await knex.schema.hasTable('chat_messages'))) {
        await knex.schema.createTable('chat_messages', (t) => {
            t.increments('id').primary();
            t.integer('sender_id').unsigned().notNullable();
            t.integer('receiver_id').unsigned().notNullable();
            t.text('message').notNullable();
            t.timestamp('timestamp').defaultTo(knex.fn.now());
            t.boolean('read').defaultTo(false);
            t.index(['sender_id', 'receiver_id'], 'idx_chat_sender_receiver');
        });
    }
    if (!(await knex.schema.hasTable('audit_trail'))) {
        await knex.schema.createTable('audit_trail', (t) => {
            t.increments('id').primary();
            t.string('entity_type', 50).notNullable();
            t.integer('entity_id').unsigned().notNullable();
            t.string('campo', 100).notNullable();
            t.text('valore_precedente').nullable();
            t.text('valore_nuovo').nullable();
            t.integer('postino_id').unsigned().notNullable();
            t.string('motivo', 500).nullable();
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.index(['entity_type', 'entity_id'], 'idx_audit_entity');
            t.index('postino_id', 'idx_audit_postino');
        });
    }
    if (!(await knex.schema.hasTable('api_keys'))) {
        await knex.schema.createTable('api_keys', (t) => {
            t.increments('id').primary();
            t.string('name', 255).notNullable();
            t.string('key_prefix', 20).notNullable();
            t.string('key_hash', 255).notNullable();
            t.text('permissions').notNullable();
            t.timestamp('last_used_at').nullable();
            t.string('last_used_ip', 100).nullable();
            t.integer('requests_count').defaultTo(0);
            t.boolean('active').defaultTo(true);
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.integer('created_by').nullable();
            t.index('key_prefix', 'idx_apikeys_prefix');
            t.index('active', 'idx_apikeys_active');
        });
    }
    if (!(await knex.schema.hasTable('app_config'))) {
        await knex.schema.createTable('app_config', (t) => {
            t.increments('id').primary();
            t.string('chiave', 100).notNullable().unique();
            t.text('valore').nullable();
            t.timestamp('updated_at').defaultTo(knex.fn.now());
        });
    }
    if (!(await knex.schema.hasTable('webhooks'))) {
        await knex.schema.createTable('webhooks', (t) => {
            t.increments('id').primary();
            t.string('url', 500).notNullable();
            t.string('barcode', 100).notNullable();
            t.string('event', 50).notNullable().defaultTo('status_change');
            t.boolean('active').defaultTo(true);
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.index(['barcode', 'active'], 'idx_webhooks_barcode_active');
        });
    }
    if (!(await knex.schema.hasTable('notifications_log'))) {
        await knex.schema.createTable('notifications_log', (t) => {
            t.increments('id').primary();
            t.string('tipo', 20).notNullable();
            t.string('destinatario', 255).notNullable();
            t.string('oggetto', 500).nullable();
            t.text('messaggio').notNullable();
            t.string('stato', 20).defaultTo('inviato');
            t.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }
    if (!(await knex.schema.hasTable('giacenza_posizioni'))) {
        await knex.schema.createTable('giacenza_posizioni', (t) => {
            t.increments('id').primary();
            t.string('barcode', 100).notNullable();
            t.string('scaffale', 50).nullable();
            t.string('contenitore', 50).nullable();
            t.string('numero_posizione', 50).nullable();
            t.timestamp('data_giacenza').defaultTo(knex.fn.now());
            t.boolean('ritirato').defaultTo(false);
            t.timestamp('data_ritiro').nullable();
            t.integer('gestore_id').unsigned().nullable();
            t.index('barcode', 'idx_giacenza_pos_barcode');
        });
    }
    if (!(await knex.schema.hasTable('esiti_archivio'))) {
        await knex.schema.createTable('esiti_archivio', (t) => {
            t.increments('id').primary();
            t.string('barcode', 100).notNullable();
            t.integer('postino_id').unsigned().nullable();
            t.string('esito', 100).nullable();
            t.date('data').nullable();
            t.string('ora', 10).nullable();
            t.decimal('latitudine', 10, 7).nullable();
            t.decimal('longitudine', 10, 7).nullable();
            t.text('note').nullable();
            t.string('foto_path', 500).nullable();
            t.timestamp('created_at').nullable();
            t.timestamp('archived_at').defaultTo(knex.fn.now());
            t.index('barcode', 'idx_esiti_arch_barcode');
            t.index('data', 'idx_esiti_arch_data');
            t.index('postino_id', 'idx_esiti_arch_postino');
            t.index('archived_at', 'idx_esiti_arch_archived');
        });
    }
}
async function down(knex) {
    const tables = [
        'esiti_archivio', 'giacenza_posizioni', 'notifications_log',
        'webhooks', 'app_config', 'api_keys', 'audit_trail',
        'chat_messages', 'refresh_tokens', 'devices',
        'geolocation_log', 'note_recapito', 'esiti', 'users',
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
}
//# sourceMappingURL=001_initial_schema.js.map