"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
function log(level, message, meta) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
    };
    console[level](JSON.stringify(entry));
}
//# sourceMappingURL=logger.js.map