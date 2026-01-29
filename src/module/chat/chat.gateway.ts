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
import {MessageService} from "../message/message.service";

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
        private readonly messageService: MessageService,
        private readonly conversationService: ConversationService,
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
            return;
        }

        const room = `room:${data.conversationId}`;
        client.join(room);
        console.log(`userId ${userId} have join room ${conversationId}`);
        console.log(client.rooms);
    }

    handleDisconnect(client: Socket): any {
        const userId = client.data.userId;
        const sockets = this.onlineUsers.get(userId);
        if (!sockets) {
            client.emit("error", {message: "user not found!"});
            client.disconnect(true);
            return;
        }
        sockets?.delete(client.id);
        if (!sockets?.size) {
            this.onlineUsers.delete(userId);
            this.server.emit("user_offline", {userId});
            console.log(`userId: ${userId} disconnected!`);
        }
        console.log(this.onlineUsers);
    }

    @SubscribeMessage("send_message")
    async handleSendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {
            conversationId: string,
            content: string
        }
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
            return;
        }

        const message = await this.messageService
            .create(
                userId,
                conversationId,
                data.content
            );
        if (!message) {
            client.emit("error", {message: "error when sending message!"});
            return;
        }
        const room = `room:${data.conversationId}`;
        this.server.to(room).emit("new_message", message);
    }
}