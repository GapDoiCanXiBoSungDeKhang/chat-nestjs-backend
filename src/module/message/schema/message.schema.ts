import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types, Document} from "mongoose";

export type MessageDocument = Message & Document;

@Schema({timestamps: true})
export class Message {
    @Prop({type: Types.ObjectId, ref: "Conversation", required: true})
    conversationId!: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: "User", required: true})
    senderId!: Types.ObjectId;

    @Prop({type: String, default: null})
    content?: string;

    @Prop({
        enum: ["text", "file", "media", "voice", "forward", "system", "call"],
        default: "text",
    })
    type!: "text" | "file" | "media" | "voice" | "forward" | "system" | "call";

    @Prop({
        type: [
            {
                userId: {type: Types.ObjectId, ref: "User"},
                emoji: String,
            }
        ],
        default: [],
    })
    reactions!: {
        userId: Types.ObjectId,
        emoji: string,
    }[];

    @Prop({type: Types.ObjectId, ref: "Message", default: null})
    replyTo?: Types.ObjectId;

    @Prop({default: false})
    isEdited!: boolean;

    @Prop({default: null})
    editedAt?: Date;

    @Prop({
        type: [{type: Types.ObjectId, ref: "User"}],
        default: []
    })
    mentions?: Types.ObjectId[];

    @Prop({
        type: [{type: Types.ObjectId, ref: "User"}],
        default: []
    })
    seenBy!: Types.ObjectId[];

    @Prop({default: false})
    isDeleted!: boolean;

    @Prop({
        type: [{type: Types.ObjectId, ref: "User"}],
        default: []
    })
    deletedFor!: Types.ObjectId[];

    @Prop({type: Boolean, default: false})
    isPinned!: boolean;

    @Prop({type: Types.ObjectId, ref: "User", default: null})
    pinByUser?: Types.ObjectId | null;

    @Prop({default: null})
    pinnedAt?: Date;

    @Prop({type: Types.ObjectId, ref: "Message", default: null})
    forwardedFrom?: Types.ObjectId;

    @Prop({
        type: {
            callType: {type: String, enum: ["voice", "video"], required: true},
            status: {
                type: String,
                enum: ["missed", "cancelled", "ended"],
                required: true,
            },
            duration: {type: Number, default: null},   // giây
            startedAt: {type: Date, default: null},
            endedAt: {type: Date, default: null},
            participants: {
                type: [{type: Types.ObjectId, ref: "User"}],
                default: [],
            },
        },
        default: null,
    })
    callInfo?: {
        callType: "voice" | "video";
        status: "missed" | "cancelled" | "ended";
        duration?: number | null;
        startedAt?: Date | null;
        endedAt?: Date | null;
        participants: Types.ObjectId[];
    } | null;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({conversationId: 1, createdAt: -1});
MessageSchema.index({ conversationId: 1, isPinned: 1 });
MessageSchema.index({conversationId: 1, deletedFor: 1, createdAt: -1});
MessageSchema.index({conversationId: 1, seenBy: 1});
MessageSchema.index({"reactions.userId": 1});
MessageSchema.index({content: "text"});

// nhưng trước đây không có index, gây full collection scan với conversation có hàng nghìn messages.
// Index này phục vụ tốt cho getUnreadCountsPerConversation aggregation và messages() pagination.
MessageSchema.index({conversationId: 1, isDeleted: 1, createdAt: -1});

// [NEW] Index cho type = "call" — dùng khi query lịch sử cuộc gọi
MessageSchema.index({conversationId: 1, type: 1, createdAt: -1});

