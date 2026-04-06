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

// [Redis] memory ram redis
import { RedisCallService } from "../shared/redis/redisCall.service";

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

        // [REDIS] Inject RedisCallService thay thế in-memory Maps
        private readonly redisCallService: RedisCallService,
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

        // Cleanup call state trên Redis nếu user đang trong cuộc gọi
        const callId = await this.redisCallService.getUserCallId(userId);
        if (callId) {
            await this._handleCallCleanup(userId, callId);
        }

        await this.userService.setOffline(userId);
        const lastSeen = new Date();
        this.presenceEmit.userOffline(userId, lastSeen);

        this.logger.debug(`Client disconnected: ${userId}`);
    }

    /**
     * [REDIS] Cleanup call state trên Redis.
     * Dùng chung cho handleDisconnect và các event call_end/call_cancel.
     */
    private async _handleCallCleanup(userId: string, callId: string): Promise<void> {
        const call = await this.redisCallService.getCall(callId);
        if (!call) return;
 
        if (call.isGroup) {
            const remaining = await this.redisCallService.removeParticipant(callId, userId);
 
            this.callEmit.groupCallLeft(call.conversationId!, {callId, userId});
 
            if (remaining === 0) {
                await this.redisCallService.deleteCall(callId, []);
                this.callEmit.groupCallEnded(call.conversationId!, {
                    callId,
                    conversationId: call.conversationId!,
                });
            }
        } else {
            const participants = await this.redisCallService.getParticipants(callId);
            const otherId = call.callerId === userId ? call.calleeId : call.callerId;
 
            await this.redisCallService.deleteCall(callId, participants);
 
            if (otherId) {
                this.callEmit.callEnded(otherId, {callId});
            }
        }
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

    @SubscribeMessage("call_end")
    public onCallEnd(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {callId: string}
    ) {
        const userId: string = client.data.userId;
        const call = activeCalls.get(data.callId);
        if (!call) return;

        const ortherId = call.callerId === userId ? call.calleeId : call.callerId;
        userInCall.delete(call.callerId);
        if (call.calleeId) userInCall.delete(call.calleeId);
        activeCalls.delete(data.callId);
        this.callEmit.callEnded(ortherId!, {callId: data.callId});
    }

    @SubscribeMessage("call_cancel")
    onCallCancel(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { callId: string },
    ) {
        const callerId = client.data.userId;
        const call = activeCalls.get(data.callId);
        if (!call || call.callerId !== callerId) return;
 
        activeCalls.delete(data.callId);
        userInCall.delete(callerId);
 
        if (call.calleeId) {
            this.callEmit.callCancelled(call.calleeId, { callId: data.callId });
        }
    }

    // FIX [SECURITY CRITICAL]: Verify participant trước khi relay SDP.
    // Trước đây chỉ check activeCalls.has(callId) nhưng không verify fromUserId có phải
    // participant hợp lệ không → attacker biết callId có thể inject SDP tùy ý.
    @SubscribeMessage("call_offer")
    onCallOffer(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {callId: string; targetUserId: string; sdp: any},
    ) {
        const fromUserId = client.data.userId;
        const call = activeCalls.get(data.callId); 
        
        // Verify fromUserId là participant hợp lệ của call này
        if (!call || !call.participants.has(fromUserId)) return;
 
        this.callEmit.callOffer(data.targetUserId, {
            callId: data.callId,
            fromUserId,
            sdp: data.sdp,
        });
    }

    // FIX [SECURITY CRITICAL]: Tương tự call_offer — verify participant
    @SubscribeMessage("call_answer")
    onCallAnswer(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { callId: string; targetUserId: string; sdp: any },
    ) {
        const fromUserId = client.data.userId;
        const call = activeCalls.get(data.callId); 
        
        // Verify fromUserId là participant hợp lệ của call này
        if (!call || !call.participants.has(fromUserId)) return;
 
        this.callEmit.callAnswer(data.targetUserId, {
            callId: data.callId,
            fromUserId,
            sdp: data.sdp,
        });
    }

    // FIX [SECURITY CRITICAL]: Tương tự — verify participant trước khi relay ICE candidate
    @SubscribeMessage("call_ice_candidate")
    onCallIceCandidate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {callId: string; targetUserId: string; candidate: any},
    ) {
         const fromUserId = client.data.userId;
        const call = activeCalls.get(data.callId);

        // Verify fromUserId là participant hợp lệ
        if (!call || !call.participants.has(fromUserId)) return;
 
        this.callEmit.callIceCandidate(data.targetUserId, {
            callId: data.callId,
            fromUserId,
            candidate: data.candidate,
        });
    }

    @SubscribeMessage("group_call_start")
    async onGroupCallStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {conversationId: string; callType: "voice" | "video"},
    ) {
        const hostId = client.data.userId;
        const ok = await this.conversationService.findUserParticipants(hostId, data.conversationId);
        if (!ok) return;
 
        const callId = randomUUID();
        activeCalls.set(callId, {
            callId,
            callerId: hostId,
            conversationId: data.conversationId,
            participants: new Set([hostId]),
            callType: data.callType,
            isGroup: true,
        });
        userInCall.set(hostId, callId);
 
        this.callEmit.groupCallStarted(data.conversationId, {
            callId,
            conversationId: data.conversationId,
            hostId,
            callType: data.callType,
        });
    }

    @SubscribeMessage("group_call_join")
    async onGroupCallJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {callId: string},
    ) {
        const userId = client.data.userId;
        const call = activeCalls.get(data.callId);
        if (!call || !call.isGroup) return;
 
        call.participants.add(userId);
        userInCall.set(userId, data.callId);
 
        const userInfo = await this.userService.getInfoById(userId);
        this.callEmit.groupCallJoined(call.conversationId!, {
            callId: data.callId,
            userId,
            userInfo: {name: userInfo.name, avatar: userInfo.avatar},
        });
    }

    @SubscribeMessage("group_call_leave")
    onGroupCallLeave(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {callId: string},
    ) {
        const userId = client.data.userId;
        const call = activeCalls.get(data.callId);
        if (!call || !call.isGroup) return;
 
        call.participants.delete(userId);
        userInCall.delete(userId);
 
        this.callEmit.groupCallLeft(call.conversationId!, {
            callId: data.callId,
            userId,
        });
 
        if (call.participants.size === 0) {
            activeCalls.delete(data.callId);
            this.callEmit.groupCallEnded(call.conversationId!, {
                callId: data.callId,
                conversationId: call.conversationId!,
            });
        }
    }

    @SubscribeMessage("group_call_end")
    onGroupCallEnd(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {callId: string},
    ) {
        const hostId = client.data.userId;
        const call = activeCalls.get(data.callId);
        if (!call || !call.isGroup || call.callerId !== hostId) return;
 
        call.participants.forEach(uid => userInCall.delete(uid));
        activeCalls.delete(data.callId);
 
        this.callEmit.groupCallEnded(call.conversationId!, {
            callId: data.callId,
            conversationId: call.conversationId!,
        });
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
