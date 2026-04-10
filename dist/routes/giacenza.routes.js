"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const giacenza_controller_1 = require("../controllers/giacenza.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.post('/', (0, auth_1.authorize)('postino', 'supervisore'), giacenza_controller_1.addToGiacenza);
router.get('/:barcode', (0, auth_1.authorize)('gestore_giacenze', 'postino', 'supervisore'), giacenza_controller_1.findByBarcode);
router.put('/retrieve/:barcode', (0, auth_1.authorize)('gestore_giacenze', 'supervisore', 'postino'), giacenza_controller_1.markRetrieved);
exports.default = router;
//# sourceMappingURL=giacenza.routes.js.map