import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types, Document} from "mongoose";

export type MessageDocument = Message & Document;

@Schema({timestamps: true})
export class Message {
    @Prop({type: Types.ObjectId, ref: "Conversation", required: true})
    conversationId!: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: "User", required: true})
    senderId!: Types.ObjectId;

    @Prop({type: String})
    content?: string;

    @Prop({
        enum: ["text", "file", "media", "voice", "forward"],
        default: "text",
    })
    type!: "text" | "file" | "media" | "voice" | "forward";

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

    @Prop({type: Number, default: 0})
    attachmentCount!: number;

    @Prop({default: false})
    isEdited!: boolean;

    @Prop({default: null})
    editedAt?: Date;

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

    @Prop({type: Types.ObjectId, ref: "Message", default: null})
    forwardedFrom?: Types.ObjectId;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({conversationId: 1, createdAt: -1});
MessageSchema.index({conversationId: 1, deletedFor: 1, createdAt: -1});
MessageSchema.index({conversationId: 1, seenBy: 1});
MessageSchema.index({"reactions.userId": 1});
MessageSchema.index({content: "text"});

