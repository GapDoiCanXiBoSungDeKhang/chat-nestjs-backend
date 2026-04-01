import {Injectable} from "@nestjs/common";
import {Server} from "socket.io";

import {gatewayRooms} from "../gateway.rooms";
import {SOCKET_EVENTS} from "../gateway.constants";

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

    public callBusy(callerId: string, payload: {callId: string}) {
        this.toUser(callerId).emit(SOCKET_EVENTS.CALL_BUSY, payload);
    }

    public callAccepted(callerId: string, payload: {callId: string}) {
        this.toUser(callerId).emit(SOCKET_EVENTS.CALL_ACCEPTED, payload);
    }

    public callRejected(callerId: string, payload: {callId: string, reasons?: string}) {
        this.toUser(callerId).emit(SOCKET_EVENTS.CALL_REJECTED, payload);
    }

    public callEnded(targetUserId: string, payload: {callId: string}) {
        this.toUser(targetUserId).emit(SOCKET_EVENTS.CALL_ENDED, payload);
    }

    public callCancelled(calleId: string, payload: {callId: string}) {
        this.toUser(calleId).emit(SOCKET_EVENTS.CALL_CANCELLED, payload);
    }

    public callOffer(targetUserId: string, payload: {
        callId: string;
        fromUserId: string;
        sdp: RTCSessionDescriptionInit;
    }) {
        this.toUser(targetUserId).emit(SOCKET_EVENTS.CALL_OFFER, payload);
    }
    
    public callAnswer(targetUserId: string, payload: {
        callId: string;
        fromUserId: string;
        sdp: RTCSessionDescriptionInit;
    }) {
        this.toUser(targetUserId).emit(SOCKET_EVENTS.CALL_ANSWER, payload);
    }
    
    public callIceCandidate(targetUserId: string, payload: {
        callId: string;
        fromUserId: string;
        candidate: RTCIceCandidateInit;
    }) {
        this.toUser(targetUserId).emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, payload);
    }

    public groupCallStarted(conversationId: string, payload: {
        callId: string;
        conversationId: string;
        hostId: string;
        callType: "voice" | "video";
    }) {
        this.toConversation(conversationId).emit(SOCKET_EVENTS.GROUP_CALL_STARTED, payload);
    }

    public groupCallJoined(conversationId: string, payload: {
        callId: string;
        userId: string;
        userInfo: {name: string; avatar?: string};
    }) {
        this.toConversation(conversationId).emit(SOCKET_EVENTS.GROUP_CALL_JOINED, payload);
    }
}