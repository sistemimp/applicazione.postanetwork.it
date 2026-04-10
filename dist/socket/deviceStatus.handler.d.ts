import { Server as SocketServer, Socket } from 'socket.io';
export interface DeviceHeartbeat {
    battery_level: number | null;
    battery_charging: boolean | null;
    connection_type: string;
    lastSeen: string;
    username: string;
    userId: number;
}
export declare const deviceHeartbeats: Map<number, DeviceHeartbeat>;
export declare function setupDeviceStatus(io: SocketServer, socket: Socket): void;
//# sourceMappingURL=deviceStatus.handler.d.ts.map