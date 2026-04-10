"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequired = validateRequired;
exports.getErrorStatusCode = getErrorStatusCode;
exports.isValidDateString = isValidDateString;
exports.escapeLikeWildcards = escapeLikeWildcards;
exports.validatePasswordPolicy = validatePasswordPolicy;
exports.isValidCoordinates = isValidCoordinates;
exports.sanitizeBarcode = sanitizeBarcode;
exports.sanitizeString = sanitizeString;
function validateRequired(fields) {
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined || value === null || value === '') {
            return `Campo obbligatorio mancante: ${key}`;
        }
    }
    return null;
}
function getErrorStatusCode(err) {
    const msg = err.message.toLowerCase();
    if (msg.includes('non trovato') || msg.includes('not found'))
        return 404;
    if (msg.includes('non autorizzato') || msg.includes('unauthorized'))
        return 403;
    if (msg.includes('gia\' registrato') || msg.includes('duplicat') || msg.includes('già'))
        return 409;
    if (msg.includes('obbligatorio') || msg.includes('mancante') || msg.includes('non valido'))
        return 400;
    return 500;
}
function isValidDateString(value) {
    if (typeof value !== 'string')
        return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}
function escapeLikeWildcards(input) {
    return input.replace(/[%_\\]/g, '\\$&');
}
/**
 * SH6: Validate password complexity.
 * Minimum 12 characters, at least one uppercase, one lowercase, one digit, one special character.
 */
function validatePasswordPolicy(password) {
    if (!password || password.length < 12) {
        return 'La password deve avere almeno 12 caratteri';
    }
    if (!/[A-Z]/.test(password)) {
        return 'La password deve contenere almeno una lettera maiuscola';
    }
    if (!/[a-z]/.test(password)) {
        return 'La password deve contenere almeno una lettera minuscola';
    }
    if (!/[0-9]/.test(password)) {
        return 'La password deve contenere almeno un numero';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        return 'La password deve contenere almeno un carattere speciale';
    }
    return null;
}
function isValidCoordinates(lat, lng) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return (!isNaN(latNum) && !isNaN(lngNum) &&
        latNum >= -90 && latNum <= 90 &&
        lngNum >= -180 && lngNum <= 180);
}
const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
};
function sanitizeBarcode(input) {
    return input.trim().replace(/\0/g, '');
}
function sanitizeString(input) {
    return input
        .trim()
        // Decode HTML entities to catch bypass attempts like &#60;script&#62;
        .replace(/&#x?[0-9a-fA-F]+;?/gi, '')
        // Remove null bytes
        .replace(/\0/g, '')
        // Strip javascript: and data: URIs (case-insensitive, with whitespace tricks)
        .replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '')
        .replace(/data\s*:/gi, '')
        .replace(/vbscript\s*:/gi, '')
        // Strip event handlers (onclick=, onerror=, etc.)
        .replace(/on\w+\s*=/gi, '')
        // Escape remaining dangerous HTML characters
        .replace(/[&<>"'`/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}
//# sourceMappingURL=validators.js.map