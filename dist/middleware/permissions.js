"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_LABELS = exports.ALL_PERMISSIONS = void 0;
exports.ensurePermissionsColumn = ensurePermissionsColumn;
exports.requirePermission = requirePermission;
const connection_1 = require("../db/connection");
const logger_1 = require("../utils/logger");
exports.ALL_PERMISSIONS = [
    'dashboard',
    'gestione_utenti',
    'spedizioni',
    'import_csv',
    'mappa_live',
    'giacenze',
    'statistiche',
    'avvisi',
    'log_accessi',
    'esporta_excel',
    'report_pdf',
    'dispositivi',
    'backup',
    'configuratore',
    'archivio',
];
exports.PERMISSION_LABELS = {
    dashboard: 'Dashboard',
    gestione_utenti: 'Gestione Utenti',
    spedizioni: 'Spedizioni',
    import_csv: 'Importa CSV',
    mappa_live: 'Mappa Live',
    giacenze: 'Giacenze',
    statistiche: 'Statistiche',
    avvisi: 'Avvisi',
    log_accessi: 'Log Accessi',
    esporta_excel: 'Esporta Excel',
    report_pdf: 'Report PDF',
    dispositivi: 'Dispositivi',
    backup: 'Backup',
    configuratore: 'Configuratore',
    archivio: 'Archivio',
};
/**
 * Ensure the permissions column exists on the users table.
 * Uses the same pattern as ensureTotpColumns in twofa.controller.ts.
 */
async function ensurePermissionsColumn() {
    const hasCol = await connection_1.dbTrack.schema.hasColumn('users', 'permissions');
    if (!hasCol) {
        await connection_1.dbTrack.schema.alterTable('users', (table) => {
            table.text('permissions').nullable();
        });
        (0, logger_1.log)('info', 'Added permissions column to users table');
    }
}
/**
 * Middleware that checks if the authenticated user has at least one
 * of the required permissions.
 *
 * If the user has no permissions set (null/empty), they have full access
 * (backward compatible — existing admin users keep full access).
 */
function requirePermission(...perms) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: 'Non autenticato' });
            return;
        }
        // SH5: If user has no permissions set (null/empty), deny access by default.
        // Admin users should have permissions explicitly assigned.
        if (!user.permissions || user.permissions.length === 0) {
            (0, logger_1.log)('warn', 'User has no permissions set — access denied by default', { userId: user.userId });
            res.status(403).json({ error: 'Nessun permesso assegnato. Contattare il supervisore per configurare i permessi.' });
            return;
        }
        // Parse permissions if it's a string
        let userPerms;
        try {
            userPerms = typeof user.permissions === 'string'
                ? JSON.parse(user.permissions)
                : user.permissions;
        }
        catch {
            // If parsing fails, deny access (secure by default)
            (0, logger_1.log)('warn', 'Failed to parse permissions', { userId: user.userId, permissions: user.permissions });
            res.status(403).json({ error: 'Permessi non validi. Contattare il supervisore.' });
            return;
        }
        if (!Array.isArray(userPerms) || userPerms.length === 0) {
            res.status(403).json({ error: 'Nessun permesso assegnato. Contattare il supervisore.' });
            return;
        }
        // Check if user has at least one of the required permissions
        if (perms.some(p => userPerms.includes(p))) {
            next();
            return;
        }
        res.status(403).json({ error: 'Non hai i permessi per questa sezione' });
    };
}
//# sourceMappingURL=permissions.js.map