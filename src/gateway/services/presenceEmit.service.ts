import {Injectable} from "@nestjs/common";
import {Server} from "socket.io";

import {SOCKET_EVENTS} from "../gateway.constants";

@Injectable()
export class PresenceEmitService {
    private server!: Server;

    setServer(server: Server) {
        this.server = server;
    }

    userOnline(userId: string) {
        this.server.emit(SOCKET_EVENTS.USER_ONLINE, {userId});
    }

    userOffline(userId: string) {
        this.server.emit(SOCKET_EVENTS.USER_OFFLINE, {userId});
    }
}
