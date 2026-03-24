import {Injectable} from "@nestjs/common";
import {Server} from "socket.io";

import {gatewayRooms} from "../gateway.rooms";
import {SOCKET_EVENTS} from "../gateway.constants";
import {Types} from "mongoose";

@Injectable()
export class GroupEmitService {
    private server!: Server;

    setServer(server: Server): void {
        this.server = server;
    }

    private toConversation(conversationId: string) {
        return this.server.to(gatewayRooms.conversation(conversationId));
    }

    private toUser(userId: string) {
        return this.server.to(gatewayRooms.user(userId));
    }

    public privateCreated(userIds: string[], payload: any) {
        const rooms = userIds.map(uid => gatewayRooms.user(uid));
        this.server.to(rooms).emit(SOCKET_EVENTS.PRIVATE_CREATED, payload);
    }

    public groupCreated(userIds: string[], payload: any) {
        const rooms = userIds.map(uid => gatewayRooms.user(uid));
        this.server.to(rooms).emit(SOCKET_EVENTS.GROUP_CREATED, payload);
    }

    public membersAdded(conversationId: string, userIds: string[], payload: any) {
        this.toConversation(conversationId).emit(SOCKET_EVENTS.GROUP_MEMBER_ADDED, payload);
        const rooms = userIds.map(uid => gatewayRooms.user(uid));
        this.server.to(rooms).emit(SOCKET_EVENTS.GROUP_ADDED, payload);
    }

    public membersRemoved(conversationId: string, userIds: string[], payload: any) {
        const rooms = userIds.map(uid => gatewayRooms.user(uid));
        this.server.in(rooms).socketsLeave(gatewayRooms.conversation(conversationId));
        this.toConversation(conversationId).emit(SOCKET_EVENTS.GROUP_MEMBER_REMOVED, payload);
        this.server.to(rooms).emit(SOCKET_EVENTS.GROUP_REMOVED, payload);
    }

    public memberLeft(conversationId: string, userId: string, payload: any) {
        this.server.in(userId).socketsLeave(gatewayRooms.conversation(conversationId));
        this.toConversation(conversationId).emit(SOCKET_EVENTS.GROUP_MEMBER_LEFT, payload);
        this.toUser(userId).emit(SOCKET_EVENTS.GROUP_LEFT_SELF, payload);
    }

    public roleChanged(conversationId: string, payload: any) {
        this.toConversation(conversationId).emit(SOCKET_EVENTS.GROUP_ROLE_CHANGED, payload);
    }

    public joinRequested(
        participants: {userId: Types.ObjectId, role: "owner" | "admin" | "member"}[],
        payload: any
    ) {
        const rooms = participants
            .filter(obj => obj.role !== "member")
            .map(obj => gatewayRooms.user(obj.userId.toString()));
        this.server.to(rooms).emit(SOCKET_EVENTS.GROUP_JOIN_REQUESTED, payload);
    }

    public requestHandled(conversationId: string, newUserId: string, payload: any) {
        this.toConversation(conversationId).emit(SOCKET_EVENTS.GROUP_REQUEST_HANDLED, payload);
        this.toUser(newUserId).emit(SOCKET_EVENTS.GROUP_REQUEST_ADDED, payload);
    }
}