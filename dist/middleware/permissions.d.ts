import { Request, Response, NextFunction } from 'express';
export declare const ALL_PERMISSIONS: string[];
export declare const PERMISSION_LABELS: Record<string, string>;
/**
 * Ensure the permissions column exists on the users table.
 * Uses the same pattern as ensureTotpColumns in twofa.controller.ts.
 */
export declare function ensurePermissionsColumn(): Promise<void>;
/**
 * Middleware that checks if the authenticated user has at least one
 * of the required permissions.
 *
 * If the user has no permissions set (null/empty), they have full access
 * (backward compatible — existing admin users keep full access).
 */
export declare function requirePermission(...perms: string[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=permissions.d.ts.map