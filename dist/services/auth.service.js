"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
class AuthService {
    /**
     * Hash a refresh token with SHA-256 before storing in DB.
     * This way, even if the DB is compromised, tokens cannot be reused.
     */
    hashToken(token) {
        return crypto_1.default.createHash('sha256').update(token).digest('hex');
    }
    generateTokens(payload) {
        const accessToken = jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
            expiresIn: config_1.config.jwt.expiresIn,
        });
        const refreshToken = jsonwebtoken_1.default.sign(payload, config_1.config.jwt.refreshSecret, {
            expiresIn: config_1.config.jwt.refreshExpiresIn,
        });
        return { accessToken, refreshToken };
    }
    verifyAccessToken(token) {
        return jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
    }
    verifyRefreshToken(token) {
        return jsonwebtoken_1.default.verify(token, config_1.config.jwt.refreshSecret);
    }
    async hashPassword(password) {
        // L7: bcrypt cost factor 12 for stronger hashing (was 10)
        return bcryptjs_1.default.hash(password, 12);
    }
    async verifyPassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map