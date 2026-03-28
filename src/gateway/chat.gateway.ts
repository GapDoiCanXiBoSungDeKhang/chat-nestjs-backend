import {
    WebSocketGateway,
    WebSocketServer,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    MessageBody,
} from "@nestjs/websockets";
import {forwardRef, Inject, Logger} from "@nestjs/common";
import {JwtService} from "@nestjs/jwt";
import {Socket, Server} from "socket.io";
import {randomUUID} from "crypto";
import {Types} from "mongoose";

import {ConversationService} from "../module/conversation/conversation.service";
import {UserService} from "../module/user/user.service";
import {MessageEmitService} from "./services/messageEmit.service";
import {GroupEmitService} from "./services/groupEmit.service";
import {PresenceEmitService} from "./services/presenceEmit.service";
import {CallEmitService} from "./services/callEmit.service";

import {gatewayRooms} from "./gateway.rooms";

import {ActiveCall} from "../common/interface/activeCall.interface";
import { Client } from "socket.io/dist/client";
import { ThrottlerStorageOptions } from "@nestjs/throttler/dist/throttler-storage-options.interface";

// dictionary calls active
const activeCalls = new Map<string, ActiveCall>();

// check user has in call
const userInCall = new Map<string, string>();

@WebSocketGateway({
    cors: {
        origin: process.env.URL_FE_CONNECT, 
        credentials: true
    },
})
export class ChatGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        @Inject(forwardRef(() => ConversationService))
        private readonly conversationService: ConversationService,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        private readonly messageEmit: MessageEmitService,
        private readonly groupEmit: GroupEmitService,
        private readonly presenceEmit: PresenceEmitService,
        private readonly callEmit: CallEmitService,
    ) {
    }

    afterInit(server: Server) {
        this.messageEmit.setServer(server);
        this.groupEmit.setServer(server);
        this.presenceEmit.setServer(server);
        this.callEmit.setServer(server);
        this.logger.log("ChatGateway initialized");
    }

    async handleConnection(client: Socket) {
        const token =
            client.handshake.auth?.token ||
            client.handshake.query?.token;

        if (!token) {
            client.disconnect(true);
            return;
        }

        try {
            const payload = this.jwtService.verify(token);
            const userId: string = payload.sub;

            client.data.userId = userId;
            client.join(gatewayRooms.user(userId));

            await this.userService.setOnline(userId);
            this.presenceEmit.userOnline(userId);

            this.logger.debug(`Client connected: ${userId}`);
        } catch {
            client.disconnect(true);
        }
    }

    async handleDisconnect(client: Socket) {
        const userId: string = client.data.userId;
        if (!userId) return;

        await this.userService.setOffline(userId);
        const lastSeen = new Date();
        this.presenceEmit.userOffline(userId, lastSeen);

        this.logger.debug(`Client disconnected: ${userId}`);
    }

    @SubscribeMessage("join_conversation")
    async joinConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string },
    ) {
        const userId: string = client.data.userId;
        const ok = await this.conversationService.findUserParticipants(userId, data.conversationId);
        if (!ok) return;

        client.join(gatewayRooms.conversation(data.conversationId));
    }

    @SubscribeMessage("leave_conversation")
    leaveConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string },
    ) {
        client.leave(gatewayRooms.conversation(data.conversationId));
    }

    @SubscribeMessage("typing_start")
    async typingStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string },
    ) {
        const userId: string = client.data.userId;

        const getPrivacy = await this.userService.getPrivacy(userId);
        if (getPrivacy && !getPrivacy.privacy.showTypingIndicator) return;

        const ok = await this.conversationService.findUserParticipants(userId, data.conversationId);
        if (!ok) return;

        client
            .to(gatewayRooms.conversation(data.conversationId))
            .emit("user_typing", {conversationId: data.conversationId, userId});
    }

    @SubscribeMessage("typing_stop")
    typingStop(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { conversationId: string },
    ) {
        const userId: string = client.data.userId;
        client
            .to(gatewayRooms.conversation(data.conversationId))
            .emit("user_stopped_typing", {conversationId: data.conversationId, userId});
    }

    @SubscribeMessage("call_initiate")
    async onCallInitiate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {calleId: string, conversationId: string, callType: "voice" | "video"}
    ) {
        const callerId: string = client.data.userId;

        const ok = await this.conversationService.findUserParticipants(
            callerId, data.conversationId
        );
        if (!ok) return;
        const setParticipants = new Set(
            ok.participants.map(obj => obj.userId.toString())
        );
        if (!setParticipants.has(data.calleId)) return;
        // need to add method event error

        if (userInCall.has(data.calleId)) {
            this.callEmit.callBusy(callerId, {callId: ""});
            return;
        };
        const callId = randomUUID();
        const callerInfor = await this.userService.findById(callerId);

        activeCalls.set(callId, {
            callId,
            callerId,
            calleeId: data.calleId,
            conversationId: data.conversationId,
            callType: data.callType,
            isGroup: false,
            participants: new Set([callerId])
        });
        userInCall.set(callerId, callId);
        this.callEmit.callInittiated(data.calleId, {
            callId,
            callerId,
            callerInfo: {name: callerInfor!.name, avatar: callerInfor?.avatar},
            callType: data.callType,
            conversationId: data.conversationId
        });
    }

    @SubscribeMessage("call_accept")
    public onCallAccept(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {callId: string}
    ) {
        const calleId: string = client.data.userId;
        const call = activeCalls.get(data.callId);
        if (!call || call.calleeId !== calleId) return;

        userInCall.set(calleId, data.callId);
        call.participants.add(calleId);

        this.callEmit.callAccepted(call.callerId, {callId: call.callId});
    }

    @SubscribeMessage("call_reject")
    public onCallReject(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {callId: string, reasons?: string}
    ) {
        const calleId: string = client.data.userId;
        const call = activeCalls.get(data.callId);
        if (!call || call.calleeId !== calleId) return;

        userInCall.delete(call.callerId);
        activeCalls.delete(data.callId);

        this.callEmit.callRejected(call.callerId, {callId: call.callId, reasons: data?.reasons});
    }

    emitNewMessage(cid: string, p: any) {
        this.messageEmit.newMessage(cid, p);
    }

    emitNewMessageFiles(cid: string, p: any) {
        this.messageEmit.newMessageFile(cid, p);
    }

    emitNewMessageMedias(cid: string, p: any) {
        this.messageEmit.newMessageMedia(cid, p);
    }

    emitNewMessageVoice(cid: string, p: any) {
        this.messageEmit.newMessageVoice(cid, p);
    }

    emitNewMessageLinkPreview(cid: string, p: any) {
        this.messageEmit.newMessageLinkPreview(cid, p);
    }

    emitMessageEdited(cid: string, p: any) {
        this.messageEmit.messageEdited(cid, p);
    }

    emitMessageDeleted(cid: string, p: any) {
        this.messageEmit.messageDeleted(cid, p);
    }

    emitMessageReacted(cid: string, p: any) {
        this.messageEmit.messageReacted(cid, p);
    }

    emitMessageForwarded(cid: string, p: any) {
        this.messageEmit.messageForwarded(cid, p);
    }

    emitMessageSeen(cid: string, p: any) {
        this.messageEmit.messageSeen(cid, p);
    }

    emitMessagePinned(cid: string, p: any) {
        this.messageEmit.messagePinned(cid, p);
    }

    emitMessageUnpinned(cid: string, p: any) {
        this.messageEmit.messageUnpinned(cid, p);
    }

    emitMentions(uids: string[], p: any) {
        this.messageEmit.messageMention(uids, p);
    }

    emitSystemRoom(cid: string, p: any) {
        this.messageEmit.messageSystemRoom(cid, p);
    }

    emitAnnouncement(cid: string, p: any) {
        this.messageEmit.announcementCreated(cid, p);
    }

    emitGroupCreated(uids: string[], p: any) {
        this.groupEmit.groupCreated(uids, p);
    }

    emitAddMembersGroup(cid: string, newUids: string[], p: any) {
        this.groupEmit.membersAdded(cid, newUids, p);
    }

    emitRemoveMembersGroup(cid: string, removedUids: string[], p: any) {
        this.groupEmit.membersRemoved(cid, removedUids, p);
    }

    emitLeftGroup(cid: string, uid: string, p: any) {
        this.groupEmit.memberLeft(cid, uid, p);
    }

    emitChangeRoleMemberGroup(cid: string, p: any) {
        this.groupEmit.roleChanged(cid, p);
    }

    emitNewRequestJoinRoom(
        participants: { userId: Types.ObjectId; role: "owner" | "admin" | "member" }[],
        p: any
    ) {
        this.groupEmit.joinRequested(participants, p);
    }

    emitHandelRequestJoinRoom(cid: string, uid: string, p: any) {
        this.groupEmit.requestHandled(cid, uid, p);
    }

    emitStatusChanged(
        userId: string,
        status: "online" | "away" | "busy" | "offline",
        customStatusMessage: string | null,
        lastSeen: Date | null,
    ) {
        this.presenceEmit.statusChanged(userId, status, customStatusMessage, lastSeen);
    }

    emitToUser(uid: string, event: string, p: any) {
        this.presenceEmit.toUser(uid, event, p);
    }
}
