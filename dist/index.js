"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.httpServer = exports.app = void 0;
exports.rescheduleBackup = rescheduleBackup;
const express_1 = __importDefault(require("express"));
//const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const node_cron_1 = __importDefault(require("node-cron"));
const config_1 = require("./config");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const routes_1 = __importDefault(require("./routes"));
const public_routes_1 = __importDefault(require("./routes/public.routes"));
const logger_1 = require("./utils/logger");
const socket_1 = require("./socket");
const connection_1 = require("./db/connection");
const migrationRunner_1 = require("./db/migrationRunner");
const app = (0, express_1.default)();
exports.app = app;
// M10: Trust proxy setting for Railway deployment.
// Value of 1 means trust the first proxy hop. Railway runs behind a reverse proxy,
// so this is required for express-rate-limit to read the correct client IP from
// X-Forwarded-For header. Without this, all requests would appear to come from
// the same IP (the proxy), making rate limiting ineffective.
// See: https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', 1);
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
const serverStartTime = new Date();
// Socket.io setup
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
    },
});
exports.io = io;
// Middleware
// app.use((0, helmet_1.default)({
//     contentSecurityPolicy: {
//         directives: {
//             defaultSrc: ["'self'"],
//             scriptSrc: [
//                 "'self'",
//                 "'unsafe-inline'",
//                 "blob:",
//                 "https://cdn.jsdelivr.net",
//                 "https://unpkg.com",
//                 "https://cdn.socket.io"
//             ],
//             scriptSrcElem: [
//                 "'self'",
//                 "'unsafe-inline'",
//                 "blob:",
//                 "https://cdn.jsdelivr.net",
//                 "https://unpkg.com",
//                 "https://cdn.socket.io"
//             ],
//             styleSrc: [
//                 "'self'",
//                 "'unsafe-inline'",
//                 "https://unpkg.com",
//                 "https://cdnjs.cloudflare.com",
//                 "https://fonts.googleapis.com"
//             ],
//             fontSrc: [
//                 "'self'",
//                 "https://fonts.gstatic.com",
//                 "https://cdnjs.cloudflare.com"
//             ],
//             imgSrc: [
//                 "'self'",
//                 "data:",
//                 "blob:",
//                 "https://*.basemaps.cartocdn.com",
//                 "https://*.openstreetmap.org",
//                 "https://tile.openstreetmap.org",
//                 "https://unpkg.com"
//             ],
//             connectSrc: ["'self'", "wss:", "ws:"],
//             workerSrc: ["'self'", "blob:"], // utile se qualche libreria usa worker blob
//             objectSrc: ["'none'"],
//             baseUri: ["'self'"],
//             upgradeInsecureRequests: []
//         },
//     },
// }));
// const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
// app.use((0, cors_1.default)({
//     origin: allowedOrigins,
//     credentials: true,
// }));
app.use((0, compression_1.default)());
app.use((0, cookie_parser_1.default)());
// L4: Route-specific body size limits
// Auth/login routes need only small payloads (1KB); photo/sync routes need 15MB
app.use('/api/v1/auth', express_1.default.json({ limit: '1kb' }));
app.use('/api/v1/sync', express_1.default.json({ limit: '15mb' }));
app.use('/api/v1/deliveries', express_1.default.json({ limit: '15mb' }));
app.use('/api/v1/photos', express_1.default.json({ limit: '15mb' }));
// Default for all other routes: 100KB (sufficient for standard JSON payloads)
app.use(express_1.default.json({ limit: '100kb' }));
app.use(rateLimiter_1.apiLimiter);
// Serve static files
app.use(express_1.default.static(path_1.default.join(__dirname, '../../posta-network-web')));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Public API (no auth)
app.use('/api/public', public_routes_1.default);
// Routes
app.use('/api/v1', routes_1.default);
// Health check (public, minimal info — no internal details exposed)
app.get('/status', async (_req, res) => {
    let dbOk = false;
    try {
        await connection_1.dbTrack.raw('SELECT 1');
        await connection_1.dbSpedizioni.raw('SELECT 1');
        dbOk = true;
    }
    catch { /* db down */ }
    const status = dbOk ? 'ok' : 'degraded';
    res.json({ status, timestamp: new Date().toISOString() });
});
// Detailed status page (authenticated, admin only)
app.get('/status/detail', async (req, res) => {
    // Simple token check for admin access
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Non autenticato' });
        return;
    }
    try {
        const { AuthService } = await Promise.resolve().then(() => __importStar(require('./services/auth.service')));
        const auth = new AuthService();
        const payload = auth.verifyAccessToken(authHeader.split(' ')[1]);
        if (payload.role !== 'supervisore') {
            res.status(403).json({ error: 'Accesso negato' });
            return;
        }
    }
    catch {
        res.status(401).json({ error: 'Token non valido' });
        return;
    }
    const startMs = Date.now();
    let dbTrackStatus = 'Disconnected';
    let dbTrackLatency = -1;
    let dbSpedizioniStatus = 'Disconnected';
    let dbSpedizioniLatency = -1;
    try {
        const t0 = Date.now();
        await connection_1.dbTrack.raw('SELECT 1');
        dbTrackLatency = Date.now() - t0;
        dbTrackStatus = 'Connected';
    }
    catch {
        dbTrackStatus = 'Disconnected';
    }
    try {
        const t0 = Date.now();
        await connection_1.dbSpedizioni.raw('SELECT 1');
        dbSpedizioniLatency = Date.now() - t0;
        dbSpedizioniStatus = 'Connected';
    }
    catch {
        dbSpedizioniStatus = 'Disconnected';
    }
    const socketCount = io.engine?.clientsCount || 0;
    const uptimeMs = Date.now() - serverStartTime.getTime();
    const mem = process.memoryUsage();
    res.json({
        dbTrack: { status: dbTrackStatus, latencyMs: dbTrackLatency },
        dbSpedizioni: { status: dbSpedizioniStatus, latencyMs: dbSpedizioniLatency },
        sockets: socketCount,
        uptimeMs,
        memory: {
            heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(1),
            rssMB: +(mem.rss / 1024 / 1024).toFixed(1),
        },
        responseMs: Date.now() - startMs,
    });
});
// Error handler
app.use(errorHandler_1.errorHandler);
// Make io accessible to routes
app.set('io', io);
(0, socket_1.setupSocket)(io);
// Cleanup expired tokens and old geolocation data every 6 hours
setInterval(async () => {
    try {
        const deletedTokens = await (0, connection_1.dbTrack)('refresh_tokens')
            .where('expires_at', '<', new Date())
            .del();
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const deletedGeo = await (0, connection_1.dbTrack)('geolocation_log')
            .where('timestamp', '<', ninetyDaysAgo)
            .del();
        if (deletedTokens > 0 || deletedGeo > 0) {
            (0, logger_1.log)('info', 'Cleanup completed', { expiredTokens: deletedTokens, oldGeoRecords: deletedGeo });
        }
    }
    catch (err) {
        (0, logger_1.log)('error', 'Cleanup failed', { error: err.message });
    }
}, 6 * 60 * 60 * 1000);
// Retry failed cross-DB updates every 30 minutes
const deliveries_service_1 = require("./services/deliveries.service");
setInterval(async () => {
    try {
        const result = await (0, deliveries_service_1.retryFailedCrossDbUpdates)();
        if (result.retried > 0) {
            (0, logger_1.log)('info', 'Cross-DB retry completed', result);
        }
    }
    catch (err) {
        (0, logger_1.log)('error', 'Cross-DB retry failed', { error: err.message });
    }
}, 30 * 60 * 1000);
// ─── Backup Scheduler ───
let backupTask = null;
async function rescheduleBackup() {
    // Stop existing task
    if (backupTask) {
        backupTask.stop();
        backupTask = null;
    }
    try {
        const { getBackupConfig, runScheduledBackup } = await Promise.resolve().then(() => __importStar(require('./services/backup.service')));
        const cfg = await getBackupConfig();
        if (!cfg || !cfg.enabled || !cfg.schedule) {
            (0, logger_1.log)('info', 'Backup scheduler: disabled or not configured');
            return;
        }
        if (!node_cron_1.default.validate(cfg.schedule)) {
            (0, logger_1.log)('error', 'Backup scheduler: invalid cron expression', { schedule: cfg.schedule });
            return;
        }
        backupTask = node_cron_1.default.schedule(cfg.schedule, async () => {
            (0, logger_1.log)('info', 'Backup cron job triggered');
            try {
                const result = await runScheduledBackup();
                (0, logger_1.log)('info', 'Backup cron job completed', { success: result.success, message: result.message });
            }
            catch (err) {
                (0, logger_1.log)('error', 'Backup cron job failed', { error: err.message });
            }
        });
        (0, logger_1.log)('info', 'Backup scheduler started', { schedule: cfg.schedule });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Failed to initialize backup scheduler', { error: err.message });
    }
}
// Graceful shutdown
async function shutdown(signal) {
    (0, logger_1.log)('info', `${signal} received — shutting down gracefully`);
    if (backupTask) {
        backupTask.stop();
        backupTask = null;
    }
    io.close();
    httpServer.close();
    await connection_1.dbTrack.destroy();
    await connection_1.dbSpedizioni.destroy();
    await connection_1.dbExternal.destroy();
    (0, logger_1.log)('info', 'All connections closed');
    process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Start
if (process.env.NODE_ENV !== 'test') {
    // DC1: Run migrations before starting the server
    // Ensure external_user_id column exists on users table
    (async () => {
        try {
            const hasCol = await connection_1.dbTrack.schema.hasColumn('users', 'external_user_id');
            if (!hasCol) {
                await connection_1.dbTrack.schema.alterTable('users', (table) => {
                    table.integer('external_user_id').unsigned().nullable();
                });
            }
        }
        catch { /* non-critical — column may already exist */ }
    })();
    // Ensure email column exists on users table
    (async () => {
        try {
            const hasCol = await connection_1.dbTrack.schema.hasColumn('users', 'email');
            if (!hasCol) {
                await connection_1.dbTrack.schema.alterTable('users', (table) => {
                    table.string('email', 255).nullable();
                });
            }
        }
        catch { /* non-critical — column may already exist */ }
    })();
    // Ensure nome/cognome columns exist on users table
    (async () => {
        try {
            const hasNome = await connection_1.dbTrack.schema.hasColumn('users', 'nome');
            const hasCognome = await connection_1.dbTrack.schema.hasColumn('users', 'cognome');
            if (!hasNome || !hasCognome) {
                await connection_1.dbTrack.schema.alterTable('users', (table) => {
                    if (!hasNome)
                        table.string('nome', 100).nullable();
                    if (!hasCognome)
                        table.string('cognome', 100).nullable();
                });
            }
        }
        catch { /* non-critical — columns may already exist */ }
    })();
    (0, migrationRunner_1.runMigrations)(connection_1.dbTrack).then(() => {
        httpServer.listen(config_1.config.port, () => {
            (0, logger_1.log)('info', `Server running on port ${config_1.config.port}`);
            // Initialize backup scheduler after server starts
            rescheduleBackup().catch(err => {
                (0, logger_1.log)('error', 'Failed to initialize backup scheduler on startup', { error: err.message });
            });
        });
    }).catch((err) => {
        (0, logger_1.log)('error', 'Failed to run migrations, starting anyway', { error: err.message });
        httpServer.listen(config_1.config.port, () => {
            (0, logger_1.log)('info', `Server running on port ${config_1.config.port} (migrations may have failed)`);
            rescheduleBackup().catch(() => { });
        });
    });
}
//# sourceMappingURL=index.js.map
