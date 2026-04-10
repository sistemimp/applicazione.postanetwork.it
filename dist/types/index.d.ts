export interface User {
    id: number;
    username: string;
    password_hash: string;
    role: 'postino' | 'gestore_giacenze' | 'supervisore';
    active: boolean;
    failed_attempts: number;
    locked_until: Date | null;
}
export interface DeliveryOutcome {
    id: number;
    barcode: string;
    esito: string;
    data: Date;
    ora: string;
    latitudine: number | null;
    longitudine: number | null;
    postino_id: number;
    note: string | null;
    firma_path: string | null;
    created_offline: boolean;
    synced_at: Date | null;
}
export interface DeliveryNote {
    id: number;
    barcode: string;
    data: Date;
    nome: string;
    cognome: string;
    indirizzo_originale: string;
    civico_originale: string;
    subcivico_originale: string;
    indirizzo_corretto: string | null;
    civico_corretto: string | null;
    subcivico_corretto: string | null;
    nota: string;
    categoria: string;
    foto_path: string | null;
    latitudine: number | null;
    longitudine: number | null;
    postino_id: number;
}
export interface AuditRecord {
    id: number;
    entity_type: string;
    entity_id: number;
    campo: string;
    valore_precedente: string;
    valore_nuovo: string;
    postino_id: number;
    motivo: string;
    created_at: Date;
}
export interface GiacenzaPosition {
    id: number;
    barcode: string;
    scaffale: string;
    contenitore: string;
    numero_posizione: string;
    data_giacenza: Date;
    ritirato: boolean;
    data_ritiro: Date | null;
    gestore_id: number | null;
}
export interface SyncQueueItem {
    id: number;
    tipo: 'esito' | 'nota' | 'correzione' | 'foto' | 'posizione';
    payload: string;
    postino_id: number;
    created_at: Date;
    retry_count: number;
    last_error: string | null;
    status: 'pending' | 'failed' | 'completed';
}
export interface JwtPayload {
    userId: number;
    username: string;
    role: string;
    permissions?: string | null;
}
//# sourceMappingURL=index.d.ts.map