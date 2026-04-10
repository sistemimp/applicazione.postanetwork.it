export declare function validateRequired(fields: Record<string, unknown>): string | null;
export declare function getErrorStatusCode(err: Error): number;
export declare function isValidDateString(value: unknown): boolean;
export declare function escapeLikeWildcards(input: string): string;
/**
 * SH6: Validate password complexity.
 * Minimum 12 characters, at least one uppercase, one lowercase, one digit, one special character.
 */
export declare function validatePasswordPolicy(password: string): string | null;
export declare function isValidCoordinates(lat: unknown, lng: unknown): boolean;
export declare function sanitizeBarcode(input: string): string;
export declare function sanitizeString(input: string): string;
//# sourceMappingURL=validators.d.ts.map