"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twoFaLimiter = exports.refreshLimiter = exports.loginLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { error: 'Troppe richieste, riprova tra un minuto' },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Troppi tentativi di login, riprova tra 15 minuti' },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.refreshLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: { error: 'Troppi tentativi di refresh, riprova tra un minuto' },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.twoFaLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: { error: 'Troppi tentativi 2FA, riprova tra 5 minuti' },
    standardHeaders: true,
    legacyHeaders: false,
});
//# sourceMappingURL=rateLimiter.js.map