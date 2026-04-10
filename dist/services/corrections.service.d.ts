export declare class CorrectionsService {
    private static readonly VALID_ESITI;
    private validateEsito;
    private syncGiacenza;
    updateOutcome(id: number, newEsito: string, postinoId: number, motivo: string): Promise<void>;
    private static readonly ALLOWED_FIELDS;
    updateRecipientData(id: number, data: Record<string, string>, postinoId: number, motivo: string, userRole?: string): Promise<void>;
    selfCorrectByBarcode(barcode: string, newEsito: string, postinoId: number): Promise<void>;
    getAuditTrail(entityType: string, entityId: number): Promise<unknown[]>;
}
//# sourceMappingURL=corrections.service.d.ts.map