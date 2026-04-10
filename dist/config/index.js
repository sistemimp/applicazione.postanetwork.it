"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be set and at least 32 characters in production!');
    }
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
        throw new Error('JWT_REFRESH_SECRET must be set and at least 32 characters in production!');
    }
}
exports.config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    dbTrack: {
        host: process.env.DB_TRACK_HOST || 'localhost',
        port: parseInt(process.env.DB_TRACK_PORT || '3306', 10),
        user: process.env.DB_TRACK_USER || 'root',
        password: process.env.DB_TRACK_PASS || '',
        database: process.env.DB_TRACK_NAME || 'track',
    },
    dbSpedizioni: {
        host: process.env.DB_SPED_HOST || 'localhost',
        port: parseInt(process.env.DB_SPED_PORT || '3306', 10),
        user: process.env.DB_SPED_USER || 'root',
        password: process.env.DB_SPED_PASS || '',
        database: process.env.DB_SPED_NAME || 'spedizioni',
    },
    dbExternal: {
        host: process.env.DB_EXT_HOST || '82.223.30.31',
        port: parseInt(process.env.DB_EXT_PORT || '3306', 10),
        user: process.env.DB_EXT_USER || 'ticketpn',
        password: process.env.DB_EXT_PASS || '',
        database: process.env.DB_EXT_NAME || 'ticket_test_postanetwork',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '30m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    },
    upload: {
        dir: process.env.UPLOAD_DIR || './uploads',
        maxPhotoSizeMB: parseInt(process.env.MAX_PHOTO_SIZE_MB || '2', 10),
    },
};
//# sourceMappingURL=index.js.map