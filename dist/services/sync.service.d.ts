export declare class SyncService {
    getShiftData(postinoId: number): Promise<{
        deliveries: unknown[];
        notes: unknown[];
        config: unknown;
    }>;
    processBatchSync(postinoId: number, items: Array<{
        tipo: string;
        payload: Record<string, unknown>;
        timestamp: string;
    }>): Promise<{
        processed: number;
        errors: Array<{
            index: number;
            error: string;
        }>;
    }>;
    getDeltaUpdates(postinoId: number, since: Date): Promise<unknown>;
}
//# sourceMappingURL=sync.service.d.ts.map