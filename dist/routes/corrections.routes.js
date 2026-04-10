"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const corrections_controller_1 = require("../controllers/corrections.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('postino', 'supervisore', 'admin'));
router.put('/self', corrections_controller_1.selfCorrect);
router.put('/outcome/:id', corrections_controller_1.updateOutcome);
router.put('/recipient/:id', corrections_controller_1.updateRecipient);
router.get('/audit/:type/:id', corrections_controller_1.getAuditTrail);
exports.default = router;
//# sourceMappingURL=corrections.routes.js.map