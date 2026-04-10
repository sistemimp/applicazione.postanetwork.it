"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbExternal = exports.dbSpedizioni = exports.dbTrack = void 0;
const knex_1 = __importDefault(require("knex"));
const config_1 = require("../config");
const poolConfig = {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    acquireTimeoutMillis: 30000,
};
const sslConfig = config_1.config.dbTrack.host.includes('tidbcloud.com')
    ? { ssl: { rejectUnauthorized: true } }
    : {};
exports.dbTrack = (0, knex_1.default)({
    client: 'mysql2',
    connection: {
        host: config_1.config.dbTrack.host,
        port: config_1.config.dbTrack.port,
        user: config_1.config.dbTrack.user,
        password: config_1.config.dbTrack.password,
        database: config_1.config.dbTrack.database,
        connectTimeout: 10000,
        ...sslConfig,
    },
    pool: poolConfig,
});
exports.dbSpedizioni = (0, knex_1.default)({
    client: 'mysql2',
    connection: {
        host: config_1.config.dbSpedizioni.host,
        port: config_1.config.dbSpedizioni.port,
        user: config_1.config.dbSpedizioni.user,
        password: config_1.config.dbSpedizioni.password,
        database: config_1.config.dbSpedizioni.database,
        connectTimeout: 10000,
        ...sslConfig,
    },
    pool: poolConfig,
});
exports.dbExternal = (0, knex_1.default)({
    client: 'mysql2',
    connection: {
        host: config_1.config.dbExternal.host,
        port: config_1.config.dbExternal.port,
        user: config_1.config.dbExternal.user,
        password: config_1.config.dbExternal.password,
        database: config_1.config.dbExternal.database,
        connectTimeout: 5000,
    },
    pool: {
        min: 1,
        max: 5,
        acquireTimeoutMillis: 30000,
    },
});
//# sourceMappingURL=connection.js.map