"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = upload;
exports.download = download;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const photos_service_1 = require("../services/photos.service");
const connection_1 = require("../db/connection");
const config_1 = require("../config");
const service = new photos_service_1.PhotosService();
function isPathSafe(filePath) {
    const resolved = path_1.default.resolve(filePath);
    const uploadDir = path_1.default.resolve(config_1.config.upload.dir);
    return resolved.startsWith(uploadDir + path_1.default.sep) || resolved === uploadDir;
}
async function upload(req, res) {
    if (!req.file) {
        res.status(400).json({ error: 'Nessun file caricato' });
        return;
    }
    const noteId = parseInt(req.params.noteId);
    try {
        const note = await (0, connection_1.dbTrack)('note_recapito').where({ id: noteId }).first();
        if (!note || note.postino_id !== req.user.userId) {
            res.status(403).json({ error: 'Non autorizzato' });
            return;
        }
        await service.linkPhotoToNote(noteId, req.file.filename);
        res.status(201).json({
            message: 'Foto caricata',
            filename: req.file.filename,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel caricamento foto' });
    }
}
async function download(req, res) {
    const noteId = parseInt(req.params.noteId);
    try {
        const note = await (0, connection_1.dbTrack)('note_recapito').where({ id: noteId }).first();
        if (!note || note.postino_id !== req.user.userId) {
            res.status(403).json({ error: 'Non autorizzato' });
            return;
        }
        const fotoPath = await service.getPhoto(noteId);
        if (!fotoPath || !fs_1.default.existsSync(fotoPath)) {
            res.status(404).json({ error: 'Foto non trovata' });
            return;
        }
        if (!isPathSafe(fotoPath)) {
            res.status(403).json({ error: 'Percorso non consentito' });
            return;
        }
        res.sendFile(path_1.default.resolve(fotoPath));
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel download foto' });
    }
}
//# sourceMappingURL=photos.controller.js.map