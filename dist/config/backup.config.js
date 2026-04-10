"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BACKUP_CONFIG = void 0;
exports.validateBackupConfig = validateBackupConfig;
exports.DEFAULT_BACKUP_CONFIG = {
    provider: 'r2',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucket: 'posta-network-backups',
    region: 'auto',
    gdriveEmail: '',
    gdriveKey: '',
    gdriveFolderId: '',
    schedule: '0 3 * * *',
    retention: 30,
    includeFoto: false,
    includeFirma: false,
    enabled: false,
};
function validateBackupConfig(cfg) {
    const errors = [];
    if (cfg.provider && !['r2', 's3', 'gdrive', 'custom'].includes(cfg.provider)) {
        errors.push('Provider deve essere r2, s3, gdrive o custom');
    }
    if (cfg.endpoint !== undefined && cfg.endpoint !== '' && !/^https?:\/\/.+/.test(cfg.endpoint)) {
        errors.push('Endpoint deve essere un URL valido (http:// o https://)');
    }
    if (cfg.bucket !== undefined && cfg.bucket !== '' && !/^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/.test(cfg.bucket)) {
        errors.push('Nome bucket non valido');
    }
    if (cfg.retention !== undefined && cfg.retention !== 'unlimited') {
        const ret = Number(cfg.retention);
        if (isNaN(ret) || ret < 1 || ret > 9999) {
            errors.push('Retention deve essere un numero tra 1 e 9999 o "unlimited"');
        }
    }
    if (cfg.schedule !== undefined && cfg.schedule !== '') {
        // Basic cron validation: 5 fields separated by spaces
        const parts = cfg.schedule.trim().split(/\s+/);
        if (parts.length !== 5) {
            errors.push('Schedule cron deve avere 5 campi (minuto ora giorno mese giorno_settimana)');
        }
    }
    return { valid: errors.length === 0, errors };
}
//# sourceMappingURL=backup.config.js.map