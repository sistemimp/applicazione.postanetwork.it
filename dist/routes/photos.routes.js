"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const auth_1 = require("../middleware/auth");
const photos_controller_1 = require("../controllers/photos.controller");
const config_1 = require("../config");
const connection_1 = require("../db/connection");
const storage = multer_1.default.diskStorage({
    destination: config_1.config.upload.dir,
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${(0, uuid_1.v4)()}${ext}`);
    },
});
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const fileFilter = (_req, file, cb) => {
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const extOk = ALLOWED_EXTENSIONS.includes(ext);
    cb(null, mimeOk && extOk);
};
const uploadMiddleware = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: config_1.config.upload.maxPhotoSizeMB * 1024 * 1024 },
});
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('postino', 'supervisore'));
// Firma digitale upload (MUST be before /:noteId to avoid route conflict)
router.post('/firma/:esitoId', uploadMiddleware.single('firma'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'Nessun file firma caricato' });
        return;
    }
    try {
        const esito = await (0, connection_1.dbTrack)('esiti').where({ id: parseInt(req.params.esitoId) }).first();
        if (!esito || esito.postino_id !== req.user.userId) {
            res.status(403).json({ error: 'Non autorizzato' });
            return;
        }
        await (0, connection_1.dbTrack)('esiti').where({ id: esito.id }).update({ firma_path: req.file.filename });
        res.status(201).json({ message: 'Firma salvata', filename: req.file.filename });
    }
    catch (err) {
        res.status(500).json({ error: 'Errore nel salvataggio firma' });
    }
});
router.post('/:noteId', uploadMiddleware.single('photo'), photos_controller_1.upload);
router.get('/:noteId', photos_controller_1.download);
exports.default = router;
//# sourceMappingURL=photos.routes.js.map