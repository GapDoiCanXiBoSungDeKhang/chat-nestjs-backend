export interface ActiveCall {
    callId: string;
    callerId: string;
    calleeId?: string;          
    conversationId?: string;    
    participants: Set<string>;
    callType: "voice" | "video";
    isGroup: boolean;
}