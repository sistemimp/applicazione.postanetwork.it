import { JwtPayload } from '../types';
export declare class AuthService {
    /**
     * Hash a refresh token with SHA-256 before storing in DB.
     * This way, even if the DB is compromised, tokens cannot be reused.
     */
    hashToken(token: string): string;
    generateTokens(payload: JwtPayload): {
        accessToken: string;
        refreshToken: string;
    };
    verifyAccessToken(token: string): JwtPayload;
    verifyRefreshToken(token: string): JwtPayload;
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
}
//# sourceMappingURL=auth.service.d.ts.map