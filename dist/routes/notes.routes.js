"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const notes_controller_1 = require("../controllers/notes.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('postino', 'supervisore'));
router.post('/', notes_controller_1.create);
router.get('/search', notes_controller_1.search);
router.get('/check/:barcode', notes_controller_1.checkExisting);
router.get('/:barcode', notes_controller_1.getByBarcode);
exports.default = router;
//# sourceMappingURL=notes.routes.js.map