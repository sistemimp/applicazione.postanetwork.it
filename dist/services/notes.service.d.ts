import { DeliveryNote } from '../types';
export declare class NotesService {
    create(data: Omit<DeliveryNote, 'id'>): Promise<number>;
    getByBarcode(barcode: string): Promise<unknown[]>;
    searchByNameOrAddress(query: string): Promise<unknown[]>;
    checkExisting(barcode: string): Promise<boolean>;
    update(id: number, data: Partial<DeliveryNote>): Promise<void>;
}
//# sourceMappingURL=notes.service.d.ts.map