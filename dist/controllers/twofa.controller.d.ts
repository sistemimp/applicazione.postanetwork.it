import { Request, Response } from 'express';
export declare function setup2FA(req: Request, res: Response): Promise<void>;
export declare function verify2FA(req: Request, res: Response): Promise<void>;
export declare function disable2FA(req: Request, res: Response): Promise<void>;
export declare function login2FA(req: Request, res: Response): Promise<void>;
export declare function generateTempToken(userId: number, username: string, role: string, device_id?: string): string;
//# sourceMappingURL=twofa.controller.d.ts.map