import {
    WebSocketGateway,
    WebSocketServer,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody
} from "@nestjs/websockets";
import {JwtService} from "@nestjs/jwt";

import {Socket, Server} from "socket.io";

import {ConversationService} from "../conversation/conversation.service";

import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@WebSocketGateway({
    cors: {
        origin: "*",
        credentials: true,
    }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly jwtService: JwtService,
        public readonly conversationService: ConversationService,
    ) {}

    private onlineUsers = new Map<string, Set<string>>();

    handleConnection(client: Socket): any {
        const token: string = client.handshake.auth?.token
            || client.handshake.query?.token;

        if (!token) {
            client.emit("error", {message: "Missing token!"});
            client.disconnect(true);
            return;
        }
        const payload = this.jwtService.verify(token);
        const userId = payload.sub;
        client.data.userId = userId;

        if (!this.onlineUsers.has(userId)) {
            this.onlineUsers.set(userId, new Set());
            this.server.emit("user_online", {userId});
        }
        this.onlineUsers.get(userId)?.add(client.id);

        console.log(`Client connected: ${client.id}`);
        console.log(this.onlineUsers);
    }

    @SubscribeMessage("join_conversation")
    async handleJoinConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {conversationId: string}
    ) {
        const userId = convertStringToObjectId(client.data.userId);
        const conversationId = convertStringToObjectId(data.conversationId);

        const checkParticipants = await this.conversationService
            .findUserParticipants(
                userId,
                conversationId
            );
        if (!checkParticipants) {
            client.emit("error", {message: "user not in conversation!"});
        }

        const room = `room:${data.conversationId}`;
        client.join(room);
        console.log(`userId ${userId} have join room ${conversationId}`);
        console.log(client.rooms);
    }

    handleDisconnect(client: any): any {
        const userId = client.data.userId;
        this.onlineUsers.delete(userId);
        console.log(`Client disconnected: ${client.id}`);
        console.log(this.onlineUsers);
    }
}