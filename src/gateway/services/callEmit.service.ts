import {Injectable} from "@nestjs/common";
import {Server} from "socket.io";

import {gatewayRooms} from "../gateway.rooms";
import {SOCKET_EVENTS} from "../gateway.constants";
import { WebSocketServer } from "@nestjs/websockets";

@Injectable()
export class CallEmitService {
    private server!: Server;

    setServer(server: Server) {
        this.server = server;
    }

    private toUser(userId: string) {
        return this.server.to(gatewayRooms.user(userId));
    }

    private toConversation(conversationId: string) {
        return this.server.to(gatewayRooms.conversation(conversationId));
    }

    public callInittiated(calleId: string, payload: {
        callId: string,
        callerId: string,
        callerInfo: {name: string, avatar?: string},
        conversationId: string;
        callType: "voice" | "video";
    }) {
        this.toUser(calleId).emit(SOCKET_EVENTS.CALL_INITIATED, payload);
    }
}