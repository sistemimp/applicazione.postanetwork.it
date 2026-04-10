export declare function retryFailedCrossDbUpdates(): Promise<{
    retried: number;
    failed: number;
    resolved: number;
}>;
export declare class DeliveriesService {
    getToday(postinoId: number): Promise<unknown[]>;
    registerOutcome(data: {
        barcode: string;
        esito: string;
        data?: string;
        ora?: string;
        latitudine?: number;
        longitudine?: number;
        postino_id: number;
        note?: string;
        firma_path?: string;
        firma_base64?: string;
        foto_base64?: string;
        reso_motivo?: string;
        created_offline?: boolean;
    }): Promise<number>;
    checkPreviousOutcome(barcode: string): Promise<unknown | null>;
    getDailyHistory(postinoId: number, date?: string): Promise<unknown[]>;
    getOptimizedRoute(postinoId: number, currentLat: number, currentLng: number): Promise<unknown[]>;
    getZoneAssignment(postinoId: number): Promise<{
        zona: string;
        count: number;
    }>;
    getPieceCounts(postinoId: number): Promise<{
        tipo_posta: string;
        count: number;
    }[]>;
    searchFreeText(query: string, lat: number, lng: number, postinoId: number): Promise<unknown[]>;
}
//# sourceMappingURL=deliveries.service.d.ts.map