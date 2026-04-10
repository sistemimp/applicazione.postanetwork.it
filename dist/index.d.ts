import { Server as SocketServer } from 'socket.io';
declare const app: import("express-serve-static-core").Express;
declare const httpServer: import("node:http").Server<typeof import("node:http").IncomingMessage, typeof import("node:http").ServerResponse>;
declare const io: SocketServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare function rescheduleBackup(): Promise<void>;
export { app, httpServer, io };
//# sourceMappingURL=index.d.ts.map