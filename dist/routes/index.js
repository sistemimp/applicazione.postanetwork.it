"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const deliveries_routes_1 = __importDefault(require("./deliveries.routes"));
const notes_routes_1 = __importDefault(require("./notes.routes"));
const corrections_routes_1 = __importDefault(require("./corrections.routes"));
const search_routes_1 = __importDefault(require("./search.routes"));
const photos_routes_1 = __importDefault(require("./photos.routes"));
const giacenza_routes_1 = __importDefault(require("./giacenza.routes"));
const config_routes_1 = __importDefault(require("./config.routes"));
const sync_routes_1 = __importDefault(require("./sync.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const data_routes_1 = __importDefault(require("./data.routes"));
const connection_1 = require("../db/connection");
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/deliveries', deliveries_routes_1.default);
router.use('/notes', notes_routes_1.default);
router.use('/corrections', corrections_routes_1.default);
router.use('/search', search_routes_1.default);
router.use('/photos', photos_routes_1.default);
router.use('/giacenza', giacenza_routes_1.default);
router.use('/config', config_routes_1.default);
router.use('/sync', sync_routes_1.default);
router.use('/admin', admin_routes_1.default);
router.use('/data', data_routes_1.default);
router.get('/health', async (_req, res) => {
    try {
        await connection_1.dbTrack.raw('SELECT 1');
        await connection_1.dbSpedizioni.raw('SELECT 1');
        res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    }
    catch (err) {
        res.status(503).json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
    }
});
exports.default = router;
//# sourceMappingURL=index.js.map