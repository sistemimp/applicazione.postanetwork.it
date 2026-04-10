import { Server as SocketServer, Socket } from 'socket.io';
export declare function setupNotifications(_io: SocketServer, _socket: Socket): void;
export declare function sendNotification(io: SocketServer, userId: number, type: string, data: Record<string, unknown>): void;
export declare function sendToRole(io: SocketServer, role: string, type: string, data: Record<string, unknown>): void;
//# sourceMappingURL=notifications.handler.d.ts.map