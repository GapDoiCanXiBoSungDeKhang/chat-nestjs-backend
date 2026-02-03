import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types, Document} from "mongoose";

export type MessageDocument = Message & Document;

@Schema({timestamps: true})
export class Message {
    @Prop({type: Types.ObjectId, ref: "Conversation", required: true})
    conversationId!: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: "User", required: true})
    senderId!: Types.ObjectId;

    @Prop({type: String, required: true})
    content!: string;

    @Prop({
        enum: ["text", "file", "image"],
        default: "text",
    })
    type!: "text" | "file" | "image";

    @Prop({
        type: [
            {
                userId: {type: Types.ObjectId, ref: "User"},
                emoji: String,
            }
        ],
        default: [],
    })
    reactions!: [
        userId: Types.ObjectId,
        emoji: string,
    ];

    @Prop({ type: Types.ObjectId, ref: "Message", default: null })
    replyTo?: Types.ObjectId;

    @Prop({ default: false })
    isEdited!: boolean;

    @Prop({ default: null })
    editedAt?: Date;

    @Prop({
        type: [{type: Types.ObjectId, ref: "User"}],
        default: []
    })
    seenBy!: Types.ObjectId[];

    @Prop({
        type: [{type: Types.ObjectId, ref: "User"}],
        default: []
    })
    deliveredTo!: Types.ObjectId[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({conversationId: 1, createdAt: 1});
MessageSchema.index({"reactions.userId": 1});
MessageSchema.index({conversationId: 1, seenBy: 1});

