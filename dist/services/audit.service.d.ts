export declare class AuditService {
    logChange(data: {
        entity_type: string;
        entity_id: number;
        campo: string;
        valore_precedente: string;
        valore_nuovo: string;
        postino_id: number;
        motivo: string;
    }): Promise<void>;
    getHistory(entityType: string, entityId: number): Promise<unknown[]>;
}
//# sourceMappingURL=audit.service.d.ts.map