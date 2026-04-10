"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotosService = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const connection_1 = require("../db/connection");
class PhotosService {
    constructor() {
        if (!fs_1.default.existsSync(config_1.config.upload.dir)) {
            fs_1.default.mkdirSync(config_1.config.upload.dir, { recursive: true });
        }
    }
    getUploadPath() {
        return config_1.config.upload.dir;
    }
    async linkPhotoToNote(noteId, filename) {
        const fotoPath = path_1.default.join(config_1.config.upload.dir, filename);
        await (0, connection_1.dbTrack)('note_recapito').where({ id: noteId }).update({ foto_path: fotoPath });
    }
    async getPhoto(noteId) {
        const note = await (0, connection_1.dbTrack)('note_recapito').where({ id: noteId }).first();
        return note?.foto_path || null;
    }
}
exports.PhotosService = PhotosService;
//# sourceMappingURL=photos.service.js.map