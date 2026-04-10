"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const auth_service_1 = require("../services/auth.service");
const authService = new auth_service_1.AuthService();
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token mancante' });
        return;
    }
    try {
        const token = header.split(' ')[1];
        req.user = authService.verifyAccessToken(token);
        next();
    }
    catch {
        res.status(401).json({ error: 'Token non valido o scaduto' });
    }
}
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Accesso non autorizzato' });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map