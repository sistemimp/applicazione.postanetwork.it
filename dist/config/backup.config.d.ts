export interface BackupCloudConfig {
    provider: 'r2' | 's3' | 'gdrive' | 'custom';
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    region: string;
    gdriveEmail: string;
    gdriveKey: string;
    gdriveFolderId: string;
    schedule: string;
    retention: number | 'unlimited';
    includeFoto: boolean;
    includeFirma: boolean;
    enabled: boolean;
}
export declare const DEFAULT_BACKUP_CONFIG: BackupCloudConfig;
export declare function validateBackupConfig(cfg: Partial<BackupCloudConfig>): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=backup.config.d.ts.map