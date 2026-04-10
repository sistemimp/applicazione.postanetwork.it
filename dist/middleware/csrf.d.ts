import { Request, Response, NextFunction } from 'express';
/**
 * Middleware to set the CSRF cookie if not present.
 * Should be applied to routes that serve the admin panel.
 */
export declare function setCsrfCookie(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware to verify CSRF token on state-changing requests.
 * Compares the cookie value against the X-CSRF-Token header.
 */
export declare function verifyCsrfToken(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=csrf.d.ts.map