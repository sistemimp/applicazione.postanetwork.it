export declare class PhotosService {
    constructor();
    getUploadPath(): string;
    linkPhotoToNote(noteId: number, filename: string): Promise<void>;
    getPhoto(noteId: number): Promise<string | null>;
}
//# sourceMappingURL=photos.service.d.ts.map