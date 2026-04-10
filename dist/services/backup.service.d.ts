import { BackupCloudConfig } from '../config/backup.config';
interface ExportOptions {
    includeFoto: boolean;
    includeFirma: boolean;
    format: 'json' | 'csv';
}
export declare function exportData(options: ExportOptions): Promise<{
    buffer: Buffer;
    metadata: Record<string, unknown>;
}>;
export declare function uploadToCloud(data: Buffer, filename: string, cfg: BackupCloudConfig): Promise<{
    success: boolean;
    message: string;
    size: number;
}>;
export declare function testCloudConnection(cfg: BackupCloudConfig): Promise<{
    success: boolean;
    message: string;
}>;
export declare function listCloudBackups(cfg: BackupCloudConfig): Promise<{
    name: string;
    size: number;
    lastModified: string;
}[]>;
export declare function applyRetentionPolicy(cfg: BackupCloudConfig): Promise<{
    deleted: number;
}>;
export declare function runScheduledBackup(): Promise<{
    success: boolean;
    message: string;
    filename?: string;
    size?: number;
}>;
export declare function getBackupConfig(): Promise<BackupCloudConfig | null>;
export declare function saveBackupConfig(cfg: Partial<BackupCloudConfig>): Promise<{
    success: boolean;
    errors?: string[];
}>;
export {};
//# sourceMappingURL=backup.service.d.ts.map