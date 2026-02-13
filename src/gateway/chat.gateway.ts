import {
    WebSocketGateway,
    WebSocketServer,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody
} from "@nestjs/websockets";
import {forwardRef, Inject} from "@nestjs/common";
import {JwtService} from "@nestjs/jwt";
import {Socket, Server} from "socket.io";

import {ConversationService} from "../module/conversation/conversation.service";

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
        @Inject(forwardRef(() => ConversationService))
        private readonly conversationService: ConversationService,
    ) {
    }

    private onlineUsers = new Map<string, Set<string>>();

    handleConnection(client: Socket) {
        const token = client.handshake.auth?.token || client.handshake.query?.token;
        if (!token) {
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

            this.onlineUsers.get(userId)!.add(client.id);
        } catch {
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (!userId) return;

        const sockets = this.onlineUsers.get(userId);
        if (!sockets) return;

        sockets.delete(client.id);
        if (sockets.size === 0) {
            this.onlineUsers.delete(userId);
            this.server.emit("user_offline", {userId});
        }
    }

    @SubscribeMessage("join_conversation")
    async joinConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        const userId = client.data.userId;
        const {conversationId} = data;

        const ok = await this.conversationService.findUserParticipants(
            userId,
            conversationId
        );
        if (!ok) return;

        const room = `room:${conversationId}`;
        client.join(room);
    }

    @SubscribeMessage("leave_conversation")
    leaveConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        client.leave(`room:${data.conversationId}`);
    }

    @SubscribeMessage("typing_start")
    typingStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        client.to(`room:${data.conversationId}`).emit("user_typing", {
            conversationId: data.conversationId,
            userId: client.data.userId,
        });
    }

    @SubscribeMessage("typing_stop")
    typingStop(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        client.to(`room:${data.conversationId}`).emit("user_stopped_typing", {
            conversationId: data.conversationId,
            userId: client.data.userId,
        });
    }

    emitNewMessage(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("new_message", payload);
    }

    emitMessageEdited(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("message_edited", payload);
    }

    emitMessageDeleted(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("message_deleted", payload);
    }

    emitMessageReacted(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("message_reacted", payload);
    }

    emitMessageForwarded(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("message_forwarded", payload);
    }

    emitMessageSeen(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("message_seen", payload);
    }

    emitNewMessageFiles(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("new_message_file", payload);
    }

    emitNewMessageMedias(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("new_message_media", payload);
    }

    emitNewMessageVoice(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("new_message_voice", payload);
    }

    emitNewMessageLinkPreview(conversationId: string, payload: any) {
        this.server.to(`room:${conversationId}`).emit("new_message_linkPreview", payload);
    }
}
