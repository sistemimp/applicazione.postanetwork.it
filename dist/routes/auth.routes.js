"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const twofa_controller_1 = require("../controllers/twofa.controller");
const rateLimiter_1 = require("../middleware/rateLimiter");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/login', rateLimiter_1.loginLimiter, auth_controller_1.login);
router.post('/refresh', rateLimiter_1.refreshLimiter, auth_controller_1.refresh);
router.post('/logout', auth_controller_1.logout);
router.put('/change-password', auth_1.authenticate, auth_controller_1.changePassword);
router.post('/push-token', auth_1.authenticate, auth_controller_1.savePushToken);
// 2FA routes
router.post('/2fa/setup', auth_1.authenticate, twofa_controller_1.setup2FA);
router.post('/2fa/verify', auth_1.authenticate, rateLimiter_1.twoFaLimiter, twofa_controller_1.verify2FA);
router.post('/2fa/disable', auth_1.authenticate, rateLimiter_1.twoFaLimiter, twofa_controller_1.disable2FA);
router.post('/2fa/login', rateLimiter_1.loginLimiter, rateLimiter_1.twoFaLimiter, twofa_controller_1.login2FA);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map