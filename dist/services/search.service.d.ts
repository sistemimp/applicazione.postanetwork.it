export declare class SearchService {
    searchByBarcode(barcode: string): Promise<unknown | null>;
    searchFreeText(query: string, lat?: number, lng?: number): Promise<unknown[]>;
    private haversine;
}
//# sourceMappingURL=search.service.d.ts.map