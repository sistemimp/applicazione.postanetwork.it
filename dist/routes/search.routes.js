"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const search_controller_1 = require("../controllers/search.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('postino', 'supervisore'));
router.get('/barcode/:barcode', search_controller_1.searchByBarcode);
router.get('/text', search_controller_1.searchFreeText);
exports.default = router;
//# sourceMappingURL=search.routes.js.map