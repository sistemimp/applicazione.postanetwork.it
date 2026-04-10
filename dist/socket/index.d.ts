import { Server as SocketServer, Socket } from 'socket.io';
/**
 * Check rate limit for a given event type. Returns true if within limit, false if exceeded.
 */
export declare function checkSocketRateLimit(userId: number, type: 'chat' | 'heartbeat'): boolean;
/**
 * Wraps a socket event handler with rate limiting.
 * If the rate limit is exceeded, disconnects the socket with an error.
 */
export declare function rateLimitedHandler(socket: Socket, userId: number, type: 'chat' | 'heartbeat', handler: (...args: any[]) => void): (...args: any[]) => void;
export declare function setupSocket(io: SocketServer): void;
//# sourceMappingURL=index.d.ts.map