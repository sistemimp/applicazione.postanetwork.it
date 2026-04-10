"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../middleware/auth");
const sync_controller_1 = require("../controllers/sync.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// M4: Specific rate limiter for batch sync — 10 batches/minute per user
const batchSyncLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => `batch_${req.user?.userId || 'anon'}`,
    message: { error: 'Troppe richieste di sync batch, riprova tra un minuto' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
});
router.get('/shift', sync_controller_1.getShiftData);
router.post('/batch', batchSyncLimiter, sync_controller_1.batchSync);
router.get('/delta', sync_controller_1.getDelta);
exports.default = router;
//# sourceMappingURL=sync.routes.js.map