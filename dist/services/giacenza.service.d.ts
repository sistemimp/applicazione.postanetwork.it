export declare class GiacenzaService {
    addToGiacenza(data: {
        barcode: string;
        scaffale: string;
        contenitore: string;
        numero_posizione: string;
    }): Promise<number>;
    findByBarcode(barcode: string): Promise<unknown | null>;
    markAsRetrieved(barcode: string, gestoreId: number): Promise<void>;
}
//# sourceMappingURL=giacenza.service.d.ts.map