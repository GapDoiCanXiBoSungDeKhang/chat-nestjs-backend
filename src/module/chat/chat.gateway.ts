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

        try {
            const payload = this.jwtService.verify(token);
            const userId = payload.sub;
            client.data.userId = userId;

            if (!this.onlineUsers.has(userId)) {
                this.onlineUsers.set(userId, new Set());
                this.server.emit("user_online", {userId});
            }
            this.onlineUsers.get(userId)?.add(client.id);

            console.log(`Client connected: ${client.id}`);
        } catch (error) {
            client.emit("error", {message: "Invalid token!"});
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket): any {
        const userId = client.data.userId;

        if (!userId) {
            console.log(`Client ${client.id} disconnected without userId`);
            return;
        }

        const sockets = this.onlineUsers.get(userId);
        if (!sockets) {
            return;
        }

        sockets.delete(client.id);
        if (sockets.size === 0) {
            this.onlineUsers.delete(userId);
            this.server.emit("user_offline", {userId});
            console.log(`User ${userId} is now offline`);
        }
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

    @SubscribeMessage('leave_conversation')
    handleLeaveConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string },
    ) {
        const room = `room:${data.conversationId}`;
        client.leave(room);
    }


    @SubscribeMessage("send_message")
    async handleSendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {
            conversationId: string,
            content: string
        }
    ) {
        try {
            const userId = convertStringToObjectId(client.data.userId);
            const conversationId = convertStringToObjectId(data.conversationId);

            const checkParticipants = await this.conversationService
                .findUserParticipants(userId, conversationId);

            if (!checkParticipants) {
                client.emit("error", {message: "user not in conversation!"});
                return;
            }

            const message = await this.messageService
                .create(userId, conversationId, data.content);

            if (!message) {
                client.emit("error", {message: "error when sending message!"});
                return;
            }

            const room = `room:${data.conversationId}`;
            this.server.to(room).emit("new_message", message);
        } catch (error) {
            console.error("Error in send_message:", error);
            client.emit("error", {message: "Failed to send message"});
        }
    }

    @SubscribeMessage("typing_start")
    handleTypingStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string },
    ) {
        const room = `room:${data.conversationId}`;
        client.to(room).emit("user_typing", {
            conversationId: data.conversationId,
            userId: client.data.userId,
        });
    }

    @SubscribeMessage("typing_stop")
    handleTypingStop(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string },
    ) {
        const room = `room:${data.conversationId}`;
        client.to(room).emit("user_stopped_typing", {
            conversationId: data.conversationId,
            userId: client.data.userId,
        });
    }
}