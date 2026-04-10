"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.changePassword = changePassword;
exports.savePushToken = savePushToken;
const auth_service_1 = require("../services/auth.service");
const connection_1 = require("../db/connection");
const validators_1 = require("../utils/validators");
const logger_1 = require("../utils/logger");
const twofa_controller_1 = require("./twofa.controller");
const authService = new auth_service_1.AuthService();
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;
// Ensure app_version column exists in devices table
connection_1.dbTrack.schema.hasColumn('devices', 'app_version').then(has => {
    if (!has) {
        connection_1.dbTrack.schema.alterTable('devices', t => { t.string('app_version', 20).nullable(); })
            .catch(() => { });
    }
}).catch(() => { });
async function login(req, res) {
    const { username, password, device_id } = req.body;
    const error = (0, validators_1.validateRequired)({ username, password });
    if (error) {
        res.status(400).json({ error });
        return;
    }
    try {
        const user = await (0, connection_1.dbTrack)('users').where({ username }).first();
        if (!user) {
            res.status(401).json({ error: 'Credenziali non valide' });
            return;
        }
        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            res.status(423).json({ error: 'Account bloccato. Riprova piu\' tardi.' });
            return;
        }
        // Check if device is blocked
        if (device_id) {
            const device = await (0, connection_1.dbTrack)('devices').where({ device_id }).first();
            if (device && device.blocked) {
                (0, logger_1.log)('warn', 'Blocked device login attempt', { username, device_id });
                res.status(403).json({ error: 'Dispositivo bloccato. Contattare il supervisore.' });
                return;
            }
        }
        const valid = await authService.verifyPassword(password, user.password_hash);
        if (!valid) {
            const attempts = (user.failed_attempts || 0) + 1;
            const update = { failed_attempts: attempts };
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                const lockUntil = new Date();
                lockUntil.setMinutes(lockUntil.getMinutes() + LOCK_DURATION_MINUTES);
                update.locked_until = lockUntil;
                (0, logger_1.log)('warn', 'Account locked', { username, attempts });
                // M8: Emit Socket.IO event and log clearly when account is locked
                try {
                    const io = req.app.get('io');
                    if (io) {
                        io.to('role:supervisore').emit('security:account_locked', {
                            username,
                            userId: user.id,
                            attempts,
                            locked_until: lockUntil.toISOString(),
                            timestamp: new Date().toISOString(),
                        });
                    }
                }
                catch (socketErr) {
                    (0, logger_1.log)('warn', 'Failed to emit account lockout event', { error: socketErr.message });
                }
            }
            await (0, connection_1.dbTrack)('users').where({ id: user.id }).update(update);
            res.status(401).json({ error: 'Credenziali non valide' });
            return;
        }
        // Reset failed attempts on success
        await (0, connection_1.dbTrack)('users').where({ id: user.id }).update({
            failed_attempts: 0,
            locked_until: null,
        });
        // Check if 2FA is enabled
        if (user.totp_enabled) {
            const tempToken = (0, twofa_controller_1.generateTempToken)(user.id, user.username, user.role, device_id);
            (0, logger_1.log)('info', 'Login requires 2FA', { userId: user.id, username });
            res.json({
                requires2FA: true,
                tempToken,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
            });
            return;
        }
        const tokens = authService.generateTokens({
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions || null,
        });
        // Save hashed refresh token and register/update device in parallel
        const parallelOps = [
            (0, connection_1.dbTrack)('refresh_tokens').insert({
                user_id: user.id,
                token: authService.hashToken(tokens.refreshToken),
                device_id: device_id || null,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            }),
        ];
        if (device_id) {
            const deviceData = {
                user_id: user.id,
                device_id,
                device_name: req.body.device_name || null,
                platform: req.body.platform || null,
                last_seen: new Date(),
            };
            const mergeData = { last_seen: new Date(), user_id: user.id };
            if (req.body.app_version) {
                deviceData.app_version = req.body.app_version;
                mergeData.app_version = req.body.app_version;
            }
            parallelOps.push((0, connection_1.dbTrack)('devices')
                .insert(deviceData)
                .onConflict('device_id')
                .merge(mergeData));
        }
        await Promise.all(parallelOps);
        (0, logger_1.log)('info', 'Login successful', { userId: user.id, username });
        res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                permissions: user.permissions || null,
            },
        });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Login error', { error: err.message });
        res.status(500).json({ error: 'Errore interno' });
    }
}
async function refresh(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token mancante' });
        return;
    }
    try {
        const payload = authService.verifyRefreshToken(refreshToken);
        const hashedToken = authService.hashToken(refreshToken);
        const stored = await (0, connection_1.dbTrack)('refresh_tokens')
            .where({ token: hashedToken, user_id: payload.userId })
            .first();
        if (!stored) {
            // L2: Token reuse detected — the token was already rotated.
            // This indicates a potential token theft. Invalidate ALL tokens for this user.
            (0, logger_1.log)('warn', 'Refresh token reuse detected — invalidating all sessions', { userId: payload.userId });
            await (0, connection_1.dbTrack)('refresh_tokens').where({ user_id: payload.userId }).del();
            res.status(401).json({ error: 'Token riutilizzato. Tutte le sessioni sono state invalidate per sicurezza.' });
            return;
        }
        // Fetch fresh role, permissions and active status from DB
        const user = await (0, connection_1.dbTrack)('users').where({ id: payload.userId }).select('role', 'permissions', 'active').first();
        if (!user || !user.active) {
            await (0, connection_1.dbTrack)('refresh_tokens').where({ id: stored.id }).del();
            res.status(401).json({ error: 'Account disabilitato o eliminato' });
            return;
        }
        // Generate new tokens with fresh data from DB
        const tokens = authService.generateTokens({
            userId: payload.userId,
            username: payload.username,
            role: user.role,
            permissions: user.permissions || null,
        });
        // Atomic token rotation in transaction
        await connection_1.dbTrack.transaction(async (trx) => {
            await trx('refresh_tokens').where({ id: stored.id }).del();
            await trx('refresh_tokens').insert({
                user_id: payload.userId,
                token: authService.hashToken(tokens.refreshToken),
                device_id: stored.device_id,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
        });
        res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    }
    catch {
        res.status(401).json({ error: 'Refresh token scaduto o non valido' });
    }
}
async function logout(req, res) {
    const { refreshToken } = req.body;
    if (refreshToken) {
        await (0, connection_1.dbTrack)('refresh_tokens').where({ token: authService.hashToken(refreshToken) }).del();
    }
    res.json({ message: 'Logout effettuato' });
}
async function changePassword(req, res) {
    const { old_password, new_password } = req.body;
    const error = (0, validators_1.validateRequired)({ old_password, new_password });
    if (error) {
        res.status(400).json({ error });
        return;
    }
    // SH6: Enforce password policy
    const policyError = (0, validators_1.validatePasswordPolicy)(new_password);
    if (policyError) {
        res.status(400).json({ error: policyError });
        return;
    }
    try {
        const user = await (0, connection_1.dbTrack)('users').where({ id: req.user.userId }).first();
        if (!user) {
            res.status(404).json({ error: 'Utente non trovato' });
            return;
        }
        const valid = await authService.verifyPassword(old_password, user.password_hash);
        if (!valid) {
            res.status(401).json({ error: 'Password attuale non corretta' });
            return;
        }
        const newHash = await authService.hashPassword(new_password);
        await (0, connection_1.dbTrack)('users').where({ id: req.user.userId }).update({ password_hash: newHash });
        (0, logger_1.log)('info', 'Password changed', { userId: req.user.userId });
        res.json({ message: 'Password aggiornata con successo' });
    }
    catch (err) {
        (0, logger_1.log)('error', 'Change password error', { error: err.message });
        res.status(500).json({ error: 'Errore nel cambio password' });
    }
}
async function savePushToken(req, res) {
    const { push_token } = req.body;
    if (!push_token) {
        res.status(400).json({ error: 'push_token mancante' });
        return;
    }
    try {
        await (0, connection_1.dbTrack)('users')
            .where({ id: req.user.userId })
            .update({ push_token: (0, validators_1.sanitizeString)(push_token) });
        (0, logger_1.log)('info', 'Push token saved', { userId: req.user.userId });
        res.json({ message: 'Push token salvato' });
    }
    catch (err) {
        // Column might not exist — handle gracefully
        (0, logger_1.log)('warn', 'Push token save failed (column may not exist)', { error: err.message });
        res.json({ message: 'Push token ricevuto', warning: 'Salvataggio potrebbe non essere persistito' });
    }
}
//# sourceMappingURL=auth.controller.js.map