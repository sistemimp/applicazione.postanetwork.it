-- =============================================================================
-- Dump database: track
-- Source: gateway01.eu-central-1.prod.aws.tidbcloud.com
-- Generated: 2026-04-10T12:29:45.391Z
-- Compatible with: MySQL 8.x, TiDB
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';


-- ----------------------------------------------------------------------------
-- Table structure for `_migrations`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `_migrations`;
CREATE TABLE `_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `applied_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `_migrations_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=81798;

-- Data for `_migrations` (2 rows)
INSERT INTO `_migrations` (`id`, `name`, `applied_at`) VALUES
  (1, '001_initial_schema', '2026-04-08 02:19:54'),
  (2, '002_add_indexes', '2026-04-08 02:19:56');


-- ----------------------------------------------------------------------------
-- Table structure for `api_keys`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `api_keys`;
CREATE TABLE `api_keys` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `key_prefix` varchar(20) NOT NULL,
  `key_hash` varchar(255) NOT NULL,
  `permissions` text NOT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `last_used_ip` varchar(100) DEFAULT NULL,
  `requests_count` int DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `api_keys_key_prefix_index` (`key_prefix`),
  KEY `api_keys_active_index` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- ----------------------------------------------------------------------------
-- Table structure for `app_config`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `app_config`;
CREATE TABLE `app_config` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `chiave` varchar(100) NOT NULL,
  `valore` text DEFAULT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `app_config_chiave_unique` (`chiave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=150001;

-- Data for `app_config` (3 rows)
INSERT INTO `app_config` (`id`, `chiave`, `valore`, `updated_at`) VALUES
  (2, 'firma_policy', '{"global":"disabled","per_postino":{}}', '2026-04-09 16:34:57'),
  (90001, 'modalita_rapida', '{"enabled":true}', '2026-04-08 19:04:06'),
  (120001, 'esiti_consegna', '{"positivi":[{"nome":"Consegnato","colore":"#4caf50","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"In Giacenza","colore":"#ff9800","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"Rifiutato","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false}],"negativi":[{"nome":"D.Sconosciuto","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"Indirizzo Errato","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":true},{"nome":"Trasferito","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"Deceduto","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"Fine Attività","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"Non ho rinvenuto il nominativo","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"Impossibile accedere a cassette","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"Info negative destinatario","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"Poste","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false},{"nome":"Altro","colore":"#8f00ff","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":true},{"nome":"Fine Giacenza","colore":"#f44336","foto_obbligatoria":false,"firma_obbligatoria":false,"note_obbligatorie":false}]}', '2026-04-09 16:34:56');


-- ----------------------------------------------------------------------------
-- Table structure for `audit_log`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_log`;
CREATE TABLE `audit_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `campo` varchar(100) NOT NULL,
  `valore_precedente` text DEFAULT NULL,
  `valore_nuovo` text DEFAULT NULL,
  `postino_id` int unsigned NOT NULL,
  `motivo` varchar(500) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_audit_entity` (`entity_type`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- ----------------------------------------------------------------------------
-- Table structure for `audit_trail`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_trail`;
CREATE TABLE `audit_trail` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `campo` varchar(100) NOT NULL,
  `valore_precedente` text DEFAULT NULL,
  `valore_nuovo` text DEFAULT NULL,
  `postino_id` int unsigned NOT NULL,
  `motivo` varchar(500) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `audit_trail_entity_type_entity_id_index` (`entity_type`,`entity_id`),
  KEY `audit_trail_postino_id_index` (`postino_id`),
  KEY `idx_audit_entity_id` (`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=8192445;


-- ----------------------------------------------------------------------------
-- Table structure for `chat_messages`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `chat_messages`;
CREATE TABLE `chat_messages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sender_id` int unsigned NOT NULL,
  `receiver_id` int unsigned NOT NULL,
  `message` text NOT NULL,
  `timestamp` timestamp DEFAULT CURRENT_TIMESTAMP,
  `read` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `chat_messages_sender_id_receiver_id_index` (`sender_id`,`receiver_id`),
  KEY `chat_messages_timestamp_index` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- ----------------------------------------------------------------------------
-- Table structure for `devices`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `device_id` varchar(100) NOT NULL,
  `device_name` varchar(200) DEFAULT NULL,
  `platform` varchar(20) DEFAULT NULL,
  `blocked` tinyint(1) DEFAULT '0',
  `last_seen` timestamp DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `app_version` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `devices_device_id_unique` (`device_id`),
  KEY `devices_user_id_index` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=6566624;

-- Data for `devices` (1 rows)
INSERT INTO `devices` (`id`, `user_id`, `device_id`, `device_name`, `platform`, `blocked`, `last_seen`, `created_at`, `app_version`) VALUES
  (6182901, 229197, 'android_1775806624566_xztue9bx', NULL, 'android', 0, '2026-04-10 07:31:19', '2026-04-10 07:31:19', '1.0.0');


-- ----------------------------------------------------------------------------
-- Table structure for `error_logs`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `error_logs`;
CREATE TABLE `error_logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `level` varchar(20) NOT NULL DEFAULT 'error',
  `message` text NOT NULL,
  `stack` text DEFAULT NULL,
  `endpoint` varchar(500) DEFAULT NULL,
  `method` varchar(10) DEFAULT NULL,
  `status_code` int DEFAULT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `ip` varchar(100) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `request_body` text DEFAULT NULL,
  `resolved` tinyint(1) DEFAULT '0',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `occurrences` int DEFAULT '1',
  `first_seen` timestamp DEFAULT CURRENT_TIMESTAMP,
  `last_seen` timestamp DEFAULT CURRENT_TIMESTAMP,
  `error_hash` varchar(64) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_error_logs_level` (`level`),
  KEY `idx_error_logs_created` (`created_at`),
  KEY `idx_error_logs_resolved` (`resolved`),
  KEY `idx_error_logs_hash` (`error_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=1644682;

-- Data for `error_logs` (1 rows)
INSERT INTO `error_logs` (`id`, `level`, `message`, `stack`, `endpoint`, `method`, `status_code`, `user_id`, `username`, `ip`, `user_agent`, `request_body`, `resolved`, `resolved_at`, `occurrences`, `first_seen`, `last_seen`, `error_hash`, `created_at`) VALUES
  (1, 'error', 'Bad escaped character in JSON at position 44 (line 1 column 45)', 'SyntaxError: Bad escaped character in JSON at position 44 (line 1 column 45)\n    at JSON.parse (<anonymous>)\n    at parse (/app/node_modules/body-parser/lib/types/json.js:72:19)\n    at /app/node_modules/body-parser/lib/read.js:162:18\n    at AsyncResource.runInAsyncScope (node:async_hooks:214:14)\n    at invokeCallback (/app/node_modules/raw-body/index.js:238:16)\n    at done (/app/node_modules/raw-body/index.js:227:7)\n    at IncomingMessage.onEnd (/app/node_modules/raw-body/index.js:287:7)\n    at IncomingMessage.emit (node:events:519:28)\n    at endReadableNT (node:internal/streams/readable:1698:12)\n    at process.processTicksAndRejections (node:internal/process/task_queues:89:21)', '/api/v1/auth/login', 'POST', 500, NULL, NULL, '104.156.89.22', 'curl/8.18.0', NULL, 1, '2026-04-03 08:39:22', 1, '2026-04-03 04:42:58', '2026-04-03 04:42:58', 'b6f5ed9e38f19bd505e94e6f7d3319e3', '2026-04-03 04:42:58');


-- ----------------------------------------------------------------------------
-- Table structure for `esiti`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `esiti`;
CREATE TABLE `esiti` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `barcode` varchar(100) NOT NULL,
  `esito` varchar(100) NOT NULL,
  `data` date NOT NULL,
  `ora` varchar(10) DEFAULT NULL,
  `latitudine` decimal(10,8) DEFAULT NULL,
  `longitudine` decimal(11,8) DEFAULT NULL,
  `postino_id` int unsigned NOT NULL,
  `note` text DEFAULT NULL,
  `firma_path` varchar(500) DEFAULT NULL,
  `foto_base64` mediumtext DEFAULT NULL,
  `created_offline` tinyint(1) DEFAULT '0',
  `synced_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `firma_base64` text DEFAULT NULL,
  `reso_motivo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_esiti_barcode_postino_data_ora` (`barcode`,`postino_id`,`data`,`ora`),
  KEY `idx_esiti_barcode` (`barcode`),
  KEY `idx_esiti_postino` (`postino_id`),
  KEY `idx_esiti_data` (`data`),
  KEY `idx_esiti_postino_data` (`postino_id`,`data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=15429904;


-- ----------------------------------------------------------------------------
-- Table structure for `esiti_archivio`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `esiti_archivio`;
CREATE TABLE `esiti_archivio` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `barcode` varchar(100) NOT NULL,
  `postino_id` int unsigned DEFAULT NULL,
  `esito` varchar(100) DEFAULT NULL,
  `data` date DEFAULT NULL,
  `ora` varchar(10) DEFAULT NULL,
  `latitudine` decimal(10,7) DEFAULT NULL,
  `longitudine` decimal(10,7) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `foto_path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `esiti_archivio_barcode_index` (`barcode`),
  KEY `esiti_archivio_data_index` (`data`),
  KEY `esiti_archivio_postino_id_index` (`postino_id`),
  KEY `esiti_archivio_archived_at_index` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- ----------------------------------------------------------------------------
-- Table structure for `failed_cross_db_updates`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `failed_cross_db_updates`;
CREATE TABLE `failed_cross_db_updates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `barcode` varchar(100) NOT NULL,
  `esito_id` int unsigned NOT NULL,
  `target_table` varchar(100) NOT NULL,
  `target_field` varchar(100) NOT NULL,
  `target_value` varchar(255) NOT NULL,
  `error_message` text DEFAULT NULL,
  `retry_count` int DEFAULT '0',
  `resolved` tinyint(1) DEFAULT '0',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `failed_cross_db_updates_resolved_created_at_index` (`resolved`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- ----------------------------------------------------------------------------
-- Table structure for `geolocation_log`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `geolocation_log`;
CREATE TABLE `geolocation_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `postino_id` int unsigned NOT NULL,
  `latitudine` decimal(10,8) NOT NULL,
  `longitudine` decimal(11,8) NOT NULL,
  `timestamp` timestamp DEFAULT CURRENT_TIMESTAMP,
  `from_offline` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `geolocation_log_postino_id_timestamp_index` (`postino_id`,`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=74150001;

-- Data for `geolocation_log` (3 rows)
INSERT INTO `geolocation_log` (`id`, `postino_id`, `latitudine`, `longitudine`, `timestamp`, `from_offline`) VALUES
  (72150002, 229182, '42.80902980', '13.81958280', '2026-04-10 05:37:10', 1),
  (72150003, 229197, '42.80902980', '13.81958280', '2026-04-10 05:37:10', 1),
  (72150004, 229197, '42.80905900', '13.81953850', '2026-04-10 07:31:21', 1);


-- ----------------------------------------------------------------------------
-- Table structure for `giacenza_posizioni`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `giacenza_posizioni`;
CREATE TABLE `giacenza_posizioni` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `barcode` varchar(100) NOT NULL,
  `scaffale` varchar(50) DEFAULT NULL,
  `contenitore` varchar(50) DEFAULT NULL,
  `numero_posizione` varchar(50) DEFAULT NULL,
  `data_giacenza` timestamp DEFAULT CURRENT_TIMESTAMP,
  `ritirato` tinyint(1) DEFAULT '0',
  `data_ritiro` timestamp NULL DEFAULT NULL,
  `gestore_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `giacenza_posizioni_barcode_index` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- ----------------------------------------------------------------------------
-- Table structure for `giacenze`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `giacenze`;
CREATE TABLE `giacenze` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `barcode` varchar(100) NOT NULL,
  `scaffale` varchar(50) DEFAULT NULL,
  `contenitore` varchar(50) DEFAULT NULL,
  `numero_posizione` varchar(50) DEFAULT NULL,
  `stato` varchar(30) DEFAULT 'attiva',
  `postino_id` varchar(255) DEFAULT NULL,
  `data_giacenza` timestamp DEFAULT CURRENT_TIMESTAMP,
  `data_ritiro` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_giacenze_barcode` (`barcode`),
  KEY `idx_giacenze_stato` (`stato`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=1525192;

-- Data for `giacenze` (1 rows)
INSERT INTO `giacenze` (`id`, `barcode`, `scaffale`, `contenitore`, `numero_posizione`, `stato`, `postino_id`, `data_giacenza`, `data_ritiro`) VALUES
  (1, '52601363295', NULL, NULL, NULL, 'attiva', '199183', '2026-04-08 22:00:00', NULL);


-- ----------------------------------------------------------------------------
-- Table structure for `note_recapito`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `note_recapito`;
CREATE TABLE `note_recapito` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `barcode` varchar(100) NOT NULL,
  `data` date NOT NULL,
  `nome` varchar(200) DEFAULT NULL,
  `cognome` varchar(200) DEFAULT NULL,
  `indirizzo_originale` varchar(300) DEFAULT NULL,
  `civico_originale` varchar(20) DEFAULT NULL,
  `subcivico_originale` varchar(20) DEFAULT NULL,
  `indirizzo_corretto` varchar(300) DEFAULT NULL,
  `civico_corretto` varchar(20) DEFAULT NULL,
  `subcivico_corretto` varchar(20) DEFAULT NULL,
  `nota` text DEFAULT NULL,
  `categoria` varchar(100) DEFAULT NULL,
  `foto_path` varchar(500) DEFAULT NULL,
  `latitudine` decimal(10,8) DEFAULT NULL,
  `longitudine` decimal(11,8) DEFAULT NULL,
  `postino_id` int unsigned NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `note_recapito_barcode_index` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- ----------------------------------------------------------------------------
-- Table structure for `notifications_log`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications_log`;
CREATE TABLE `notifications_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tipo` varchar(20) NOT NULL,
  `destinatario` varchar(255) NOT NULL,
  `oggetto` varchar(500) DEFAULT NULL,
  `messaggio` text NOT NULL,
  `stato` varchar(20) DEFAULT 'inviato',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- ----------------------------------------------------------------------------
-- Table structure for `refresh_tokens`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `refresh_tokens`;
CREATE TABLE `refresh_tokens` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `token` varchar(500) NOT NULL,
  `device_id` varchar(100) DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `refresh_tokens_user_id_index` (`user_id`),
  KEY `refresh_tokens_token_index` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=91696617;

-- Data for `refresh_tokens` (3 rows)
INSERT INTO `refresh_tokens` (`id`, `user_id`, `token`, `device_id`, `expires_at`, `created_at`) VALUES
  (89696618, 1, '83ad4ad68e243b9eb43e8207a246a2fe01b6a21cb22fc2e3472e9a1a10dddc1b', NULL, '2026-05-10 07:22:16', '2026-04-10 07:22:15'),
  (89696620, 229197, '533552a5783be98bc1aec36bb242521ade6077b0c7eaa442ef4ec2a3ce302d9e', 'android_1775806624566_xztue9bx', '2026-05-10 07:31:19', '2026-04-10 07:31:19'),
  (89696621, 229197, '73c330c2cfa53461ffbe43ed5cd73f2997de20be6dd7255ee604c65e8dc35b9b', NULL, '2026-05-10 07:44:10', '2026-04-10 07:44:09');


-- ----------------------------------------------------------------------------
-- Table structure for `users`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'postino',
  `active` tinyint(1) DEFAULT '1',
  `failed_attempts` int DEFAULT '0',
  `locked_until` timestamp NULL DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `permissions` text DEFAULT NULL,
  `totp_secret` varchar(255) DEFAULT NULL,
  `totp_enabled` tinyint(1) DEFAULT '0',
  `firma_override` varchar(100) DEFAULT NULL,
  `telefono` varchar(50) DEFAULT NULL,
  `external_user_id` int unsigned DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `nome` varchar(100) DEFAULT NULL,
  `cognome` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `users_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=259182;

-- Data for `users` (21 rows)
INSERT INTO `users` (`id`, `username`, `password_hash`, `role`, `active`, `failed_attempts`, `locked_until`, `created_at`, `permissions`, `totp_secret`, `totp_enabled`, `firma_override`, `telefono`, `external_user_id`, `email`, `nome`, `cognome`) VALUES
  (1, 'admin', '$2b$12$FUn6nRZpwiqfxrNfSPG.XeEaM/lHcrCuAJS05wS/Ut1CHFVM8iFG.', 'supervisore', 1, 0, NULL, '2026-03-27 09:51:52', '["dashboard","gestione_utenti","spedizioni","import_csv","mappa_live","giacenze","statistiche","avvisi","log_accessi","esporta_excel","report_pdf","dispositivi","backup","configuratore","archivio"]', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL),
  (229183, 'g.pantoli.mp', '$2a$07$9af581c4m3fCG76a1y5k5uIyxhVBOYt1Sc9q.gB0eE0wDZbzLkMZy', 'supervisore', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard","gestione_utenti","spedizioni","import_csv","mappa_live","giacenze","statistiche","avvisi","log_accessi","esporta_excel","report_pdf","dispositivi","backup","configuratore","archivio"]', NULL, 0, NULL, NULL, 1, 'g.pantoli.mp@gmail.com', 'Gabriel', 'Pantoli'),
  (229184, 'info', '$2a$07$9af581c4m3fCG76a1y5k5uUQpc05RA0ItLYvjriISK.rkhSzEz00G', 'supervisore', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard","gestione_utenti","spedizioni","import_csv","mappa_live","giacenze","statistiche","avvisi","log_accessi","esporta_excel","report_pdf","dispositivi","backup","configuratore","archivio"]', NULL, 0, NULL, NULL, 8, 'info@postanetwork.it', 'Daniele', 'Sciarretta'),
  (229185, 'alessiotarquini', '$2a$07$9af581c4m3fCG76a1y5k5uvWpnbJ4.17v/PW06EAguAgz6DnXa.zG', 'supervisore', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard","gestione_utenti","spedizioni","import_csv","mappa_live","giacenze","statistiche","avvisi","log_accessi","esporta_excel","report_pdf","dispositivi","backup","configuratore","archivio"]', NULL, 0, NULL, NULL, 11, 'alessiotarquini@postanetwork.it', 'Alessio', 'Tarquini'),
  (229186, 'ermesdigiacinto16', '$2a$07$9af581c4m3fCG76a1y5k5uuHzwH1a6tA4MPf0HZgF5cCsG8IWcVbu', 'supervisore', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard","gestione_utenti","spedizioni","import_csv","mappa_live","giacenze","statistiche","avvisi","log_accessi","esporta_excel","report_pdf","dispositivi","backup","configuratore","archivio"]', NULL, 0, NULL, NULL, 25, 'ermesdigiacinto16@gmail.com', 'Ermes', 'Di Giacinto'),
  (229187, 'lorenzo.t', '$2a$07$9af581c4m3fCG76a1y5k5uYsqAX0wDHXNNQaRptsyYQ.rSHFE9iea', 'postino', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 30, 'lorenzo.t@postanetwork.it', 'Lorenzo', 'Traini'),
  (229188, 'pettinato_antonio', '$2a$07$9af581c4m3fCG76a1y5k5uS/VEmvul5jy9cRwTIt6.jxefxNOPOxG', 'postino', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 40, 'pettinato_antonio@libero.it', 'Antonio', 'Pettinato'),
  (229189, 'davide.sciarretta', '$2a$07$9af581c4m3fCG76a1y5k5uxVWMA24J0HsCpi/Tcy1eipX6VEKp99a', 'postino', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 51, 'davide.sciarretta@gmail.com', 'Davide', 'Sciarretta'),
  (229190, 'katia.r', '$2a$07$9af581c4m3fCG76a1y5k5uGAXpZTvMb6dBAxgTSjS3QqQ69/BM8Y2', 'supervisore', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard","gestione_utenti","spedizioni","import_csv","mappa_live","giacenze","statistiche","avvisi","log_accessi","esporta_excel","report_pdf","dispositivi","backup","configuratore","archivio"]', NULL, 0, NULL, NULL, 56, 'katia.r@postanetwork.it', 'Katia', 'Romagnuolo'),
  (229191, 'daniele', '$2a$07$9af581c4m3fCG76a1y5k5umEykiFPO74FhugPFcVhXxs1KItd9YJ6', 'postino', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 85, 'daniele@mediaprint.it', 'Gaia', 'Di Bonaventura'),
  (229192, 'simone.a', '$2a$07$9af581c4m3fCG76a1y5k5uVatsNJPHK/Iq774CroKnMVM4CYDtif6', 'postino', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 92, 'simone.a@postanetwork.it', 'Simone', 'Alessandrini'),
  (229193, 'marco.g', '$2a$07$9af581c4m3fCG76a1y5k5uQ6l0iEXEQXaQtDSESYkz6r/eB9Os78a', 'postino', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 93, 'marco.g@mediaprint.it', 'Marco', 'Gucciardi'),
  (229194, 'oriettadc', '$2a$07$9af581c4m3fCG76a1y5k5uForAQBGk90YiguI.ZTt62nB.v1N3KrG', 'postino', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 94, 'oriettadc@postanetwork.it', 'Orietta', 'De Carolis'),
  (229195, 'milena.m', '$2a$07$9af581c4m3fCG76a1y5k5u8foJl64c48MlTmlPwfNVJPqxKI/nzEi', 'postino', 1, 0, NULL, '2026-04-10 07:11:36', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 95, 'milena.m@postanetwork.it', 'Milena', 'Moroni'),
  (229196, 'amministrazione', '$2a$07$9af581c4m3fCG76a1y5k5uCnYjI/Z0NR/daXbLt01UAdnhFcDz9mK', 'supervisore', 1, 0, NULL, '2026-04-10 07:11:37', '["dashboard","gestione_utenti","spedizioni","import_csv","mappa_live","giacenze","statistiche","avvisi","log_accessi","esporta_excel","report_pdf","dispositivi","backup","configuratore","archivio"]', NULL, 0, NULL, NULL, 99, 'amministrazione@postanetwork.it', 'Federica', 'Lucini'),
  (229197, 'f.diomede', '$2a$07$9af581c4m3fCG76a1y5k5uoVWOu5RR/YMfRQQuWCB9n0tvss9GKHW', 'supervisore', 1, 0, NULL, '2026-04-10 07:11:37', '["dashboard","gestione_utenti","spedizioni","import_csv","mappa_live","giacenze","statistiche","avvisi","log_accessi","esporta_excel","report_pdf","dispositivi","backup","configuratore","archivio"]', NULL, 0, NULL, NULL, 100, 'f.diomede@mediaprint.it', 'Stesy Franco', 'Diomede'),
  (229198, 'vincenzo.m', '$2a$07$9af581c4m3fCG76a1y5k5uqK1dZ73iKZ1V/.mL.fszCNzbSGDyv0i', 'postino', 1, 0, NULL, '2026-04-10 07:11:37', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 101, 'vincenzo.m@postanetwork.it', 'Vincenzo', 'Miceli'),
  (229199, 'davidevaleriani', '$2a$07$9af581c4m3fCG76a1y5k5uClXjgNJDlsMADoDKkCuhkkuuhTnBA42', 'postino', 1, 0, NULL, '2026-04-10 07:11:37', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 107, 'davidevaleriani@proton.me', 'Davide', 'Valeriani'),
  (229200, 'teluca.marinelli', '$2a$07$9af581c4m3fCG76a1y5k5usmsZ2fQ1lywFH6/yMfgiqUQSMUHKadG', 'postino', 1, 0, NULL, '2026-04-10 07:11:37', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 108, 'teluca.marinelli@gmail.com', 'Luca', 'Marinelli'),
  (229201, 'alex.o', '$2a$07$9af581c4m3fCG76a1y5k5uK4i9dXcg3htPT0gTW.tZztMLM8VaGs2', 'supervisore', 1, 0, NULL, '2026-04-10 07:11:37', '["dashboard","gestione_utenti","spedizioni","import_csv","mappa_live","giacenze","statistiche","avvisi","log_accessi","esporta_excel","report_pdf","dispositivi","backup","configuratore","archivio"]', NULL, 0, NULL, NULL, 109, 'alex.o@mediaprint.it', 'Alex', 'Olivieri'),
  (229202, 'michelefalanga31', '$2a$07$9af581c4m3fCG76a1y5k5uJUH7gwFXr75YMqjgLMqi1WznToQmYdy', 'postino', 1, 0, NULL, '2026-04-10 07:11:37', '["dashboard.view","deliveries.manage"]', NULL, 0, NULL, NULL, 110, 'michelefalanga31@gmail.com', 'Michele', 'Falanga');


-- ----------------------------------------------------------------------------
-- Table structure for `webhooks`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `webhooks`;
CREATE TABLE `webhooks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `url` varchar(500) NOT NULL,
  `barcode` varchar(100) NOT NULL,
  `event` varchar(50) NOT NULL DEFAULT 'status_change',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `webhooks_barcode_active_index` (`barcode`,`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


SET FOREIGN_KEY_CHECKS = 1;
-- End of dump
