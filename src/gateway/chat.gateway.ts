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
import {Types} from "mongoose";

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

    private userRoom(userId: string) {
        return `user:${userId}`;
    }

    private conversationRoom(userId: string) {
        return `conversation:${userId}`;
    }

    handleConnection(client: Socket) {
        const token = client.handshake.auth?.token ||
            client.handshake.query?.token;

        if (!token) {
            client.disconnect(true);
            return;
        }

        try {
            const payload = this.jwtService.verify(token);
            const userId = payload.sub;

            client.data.userId = userId;

            client.join(this.userRoom(userId));
            this.server.emit("user_online", {userId});
        } catch {
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (!userId) return;

        this.server.emit("user_offline", {userId});
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

        const room = this.conversationRoom(conversationId);
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
        this.server.to(this.conversationRoom(conversationId)).emit("new_message", payload);
    }

    emitMessageEdited(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("message_edited", payload);
    }

    emitMessageDeleted(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("message_deleted", payload);
    }

    emitMessageReacted(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("message_reacted", payload);
    }

    emitMessageForwarded(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("message_forwarded", payload);
    }

    emitMessageSeen(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("message_seen", payload);
    }

    emitNewMessageFiles(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("new_message_file", payload);
    }

    emitNewMessageMedias(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("new_message_media", payload);
    }

    emitNewMessageVoice(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("new_message_voice", payload);
    }

    emitNewMessageLinkPreview(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("new_message_linkPreview", payload);
    }

    emitToUser(userId: string, event: string, data: any) {
        this.server.to(this.userRoom(userId)).emit(event, data);
    }

    emitMessagePinned(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("message_pinned", payload);
    }

    emitMessageUnpinned(conversationId: string, payload: any) {
        this.server.to(this.conversationRoom(conversationId)).emit("message_unpinned", payload);
    }

    emitGroupCreated(userIds: string[], payload: any) {
        userIds.forEach((userId) => {
            this.server
                .to(this.userRoom(userId))
                .emit("group_created", payload);
        });
    }

    emitAddMembersGroup(
        conversationId: string,
        newUserIds: string[],
        payload: any
    ) {
        this.server
            .to(this.conversationRoom(conversationId))
            .emit("group_member_added", payload);

        newUserIds.forEach((userId) => {
            this.server
                .to(this.userRoom(userId))
                .emit("group_added", payload);
        })
    }

    emitRemoveMembersGroup(
        conversationId: string,
        removedUserIds: string[],
        payload: any
    ) {
        removedUserIds.forEach(userId => {
            this.server.in(this.userRoom(userId)).socketsLeave(
                this.conversationRoom(conversationId),
            );
        })
        this.server
            .to(this.conversationRoom(conversationId))
            .emit("group_member_removed", payload);

        removedUserIds.forEach((userId) => {
            this.server
                .to(this.userRoom(userId))
                .emit("group_removed", payload);
        })
    }

    emitLeftGroup(
        conversationId: string,
        userId: string,
        payload: any
    ) {
        this.server.in(this.userRoom(userId)).socketsLeave(
            this.conversationRoom(conversationId),
        );
        this.server
            .to(this.conversationRoom(conversationId))
            .emit("group_member_left", payload);

        this.server
            .to(this.userRoom(userId))
            .emit("group_left_self", payload);
    }

    emitChangeRoleMemberGroup(conversationId: string, payload: any) {
        this.server
            .to(this.conversationRoom(conversationId))
            .emit("group_role_changed", payload);
    }

    emitNewRequestJoinRoom(
        participants: {
            userId: Types.ObjectId
            role: "owner" | "admin" | "member"
        }[],
        payload: any
    ) {
        const rooms = participants
            .filter(obj => obj.role !== "member")
            .map(obj => obj.userId.toString());

        this.server.to(rooms).emit("group_join_requested", payload);
    }

    emitHandelRequestJoinRoom(
        conversationId: string,
        newUserId: string,
        payload: any
    ) {
        this.server
            .to(this.conversationRoom(conversationId))
            .emit("group_request_handled", payload);

        this.server
            .to(this.userRoom(newUserId))
            .emit("group_request_added", payload);
    }
}
