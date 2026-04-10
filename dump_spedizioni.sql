-- =============================================================================
-- Dump database: spedizioni
-- Source: gateway01.eu-central-1.prod.aws.tidbcloud.com
-- Generated: 2026-04-10T12:29:47.950Z
-- Compatible with: MySQL 8.x, TiDB
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';


-- ----------------------------------------------------------------------------
-- Table structure for `spedizioni`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `spedizioni`;
CREATE TABLE `spedizioni` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `barcode` varchar(100) NOT NULL,
  `destinatario_nome` varchar(200) DEFAULT NULL,
  `destinatario_cognome` varchar(200) DEFAULT NULL,
  `indirizzo` varchar(300) DEFAULT NULL,
  `civico` varchar(20) DEFAULT NULL,
  `subcivico` varchar(20) DEFAULT NULL,
  `cap` varchar(10) DEFAULT NULL,
  `comune` varchar(100) DEFAULT NULL,
  `provincia` varchar(5) DEFAULT NULL,
  `tipo_posta` varchar(50) DEFAULT NULL,
  `postino_id` int unsigned DEFAULT NULL,
  `data_assegnazione` date DEFAULT NULL,
  `latitudine` decimal(10,8) DEFAULT NULL,
  `longitudine` decimal(11,8) DEFAULT NULL,
  `stato` varchar(50) DEFAULT 'da_lavorare',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_sped_barcode` (`barcode`),
  KEY `idx_sped_postino` (`postino_id`),
  KEY `idx_sped_stato` (`stato`),
  KEY `idx_sped_data` (`data_assegnazione`),
  KEY `idx_sped_postino_stato` (`postino_id`,`stato`),
  KEY `idx_sped_nome` (`destinatario_cognome`,`destinatario_nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


-- ----------------------------------------------------------------------------
-- Table structure for `spedizioni_archivio`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `spedizioni_archivio`;
CREATE TABLE `spedizioni_archivio` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `barcode` varchar(100) NOT NULL,
  `destinatario_nome` varchar(255) DEFAULT NULL,
  `destinatario_cognome` varchar(255) DEFAULT NULL,
  `indirizzo` varchar(500) DEFAULT NULL,
  `civico` varchar(20) DEFAULT NULL,
  `subcivico` varchar(20) DEFAULT NULL,
  `cap` varchar(10) DEFAULT NULL,
  `comune` varchar(255) DEFAULT NULL,
  `provincia` varchar(10) DEFAULT NULL,
  `tipo_posta` varchar(100) DEFAULT NULL,
  `tipo_spedizione` varchar(100) DEFAULT NULL,
  `stato` varchar(50) DEFAULT NULL,
  `postino_id` int unsigned DEFAULT NULL,
  `data_assegnazione` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `spedizioni_archivio_barcode_index` (`barcode`),
  KEY `spedizioni_archivio_stato_data_index` (`stato`,`data_assegnazione`),
  KEY `spedizioni_archivio_postino_id_index` (`postino_id`),
  KEY `spedizioni_archivio_archived_at_index` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;


SET FOREIGN_KEY_CHECKS = 1;
-- End of dump
