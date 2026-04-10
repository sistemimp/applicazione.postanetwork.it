"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGeolocation = setupGeolocation;
const connection_1 = require("../db/connection");
const logger_1 = require("../utils/logger");
const index_1 = require("./index");
const validators_1 = require("../utils/validators");
function setupGeolocation(io, socket) {
    const user = socket.data.user;
    socket.on('geo:update', async (data) => {
        try {
            // Rate limit: geo updates count as heartbeat (max 120/min)
            if (!(0, index_1.checkSocketRateLimit)(user.userId, 'heartbeat')) {
                (0, logger_1.log)('warn', 'Geo rate limit exceeded', { userId: user.userId });
                socket.emit('error', { message: 'Troppi aggiornamenti GPS. Riprova tra un minuto.' });
                socket.disconnect(true);
                return;
            }
            if (!(0, validators_1.isValidCoordinates)(data.latitudine, data.longitudine)) {
                socket.emit('error', { message: 'Coordinate GPS non valide' });
                return;
            }
            await (0, connection_1.dbTrack)('geolocation_log').insert({
                postino_id: user.userId,
                latitudine: data.latitudine,
                longitudine: data.longitudine,
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                from_offline: data.from_offline || false,
            });
            io.to('perm:mappa_live').emit('geo:position', {
                postino_id: user.userId,
                username: user.username,
                latitudine: data.latitudine,
                longitudine: data.longitudine,
                timestamp: new Date().toISOString(),
            });
        }
        catch (err) {
            (0, logger_1.log)('error', 'Geo update error', { userId: user.userId, error: err.message });
        }
    });
    socket.on('geo:batch', async (positions) => {
        try {
            // Limit batch size to 1000 coordinates
            if (positions.length > 1000) {
                positions = positions.slice(0, 1000);
            }
            // L5: Validate coordinates with sanity checks — filter out impossible values
            // isValidCoordinates checks range (-90/90, -180/180); also filter exact 0,0 (Null Island)
            const validPositions = positions.filter((p) => {
                if (!(0, validators_1.isValidCoordinates)(p.latitudine, p.longitudine))
                    return false;
                // L5: Reject exact 0,0 (Null Island — GPS default when no fix)
                if (p.latitudine === 0 && p.longitudine === 0)
                    return false;
                // L5: Reject if timestamp is missing or invalid
                if (!p.timestamp || isNaN(new Date(p.timestamp).getTime()))
                    return false;
                return true;
            });
            if (validPositions.length === 0) {
                socket.emit('geo:batch_ack', { count: 0 });
                return;
            }
            const rows = validPositions.map((p) => ({
                postino_id: user.userId,
                latitudine: p.latitudine,
                longitudine: p.longitudine,
                timestamp: new Date(p.timestamp),
                from_offline: true,
            }));
            await (0, connection_1.dbTrack)('geolocation_log').insert(rows);
            socket.emit('geo:batch_ack', { count: validPositions.length });
            (0, logger_1.log)('info', 'Batch geo sync', { userId: user.userId, count: validPositions.length });
        }
        catch (err) {
            (0, logger_1.log)('error', 'Batch geo error', { error: err.message });
        }
    });
    socket.on('geo:get_all', async () => {
        if (user.role !== 'supervisore')
            return;
        try {
            const positions = await (0, connection_1.dbTrack)('geolocation_log')
                .select('postino_id', 'latitudine', 'longitudine', 'timestamp')
                .whereIn('id', function () {
                this.select(connection_1.dbTrack.raw('MAX(id)'))
                    .from('geolocation_log')
                    .groupBy('postino_id');
            });
            socket.emit('geo:all_positions', positions);
        }
        catch (err) {
            (0, logger_1.log)('error', 'Get all positions error', { error: err.message });
        }
    });
}
//# sourceMappingURL=geolocation.handler.js.map