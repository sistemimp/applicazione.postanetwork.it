import { Request, Response, NextFunction } from 'express';
/**
 * Middleware that checks IP whitelist for admin routes.
 * Applied ONLY to admin routes. If disabled, passes through.
 */
export declare function ipWhitelistMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Endpoint to get the client's current IP address (used by admin panel).
 */
export declare function getCurrentIp(req: Request, res: Response): void;
/**
 * Force refresh the cached IP whitelist config.
 */
export declare function invalidateIpWhitelistCache(): void;
//# sourceMappingURL=ipWhitelist.d.ts.map