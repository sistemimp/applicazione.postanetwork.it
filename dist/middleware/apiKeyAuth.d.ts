import { Request, Response, NextFunction } from 'express';
export declare function ensureApiKeysTable(): Promise<void>;
export declare function invalidateApiKeyCache(): void;
export declare function generateApiKey(): string;
export declare function hashApiKey(key: string): Promise<string>;
export declare function apiKeyAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function combinedAuth(req: Request, res: Response, next: NextFunction): void;
export declare function checkApiKeyPermission(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=apiKeyAuth.d.ts.map