import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types} from "mongoose";
import {Document} from "mongoose";

export type ConversationDocument = Conversation & Document;

@Schema({timestamps: true})
export class Conversation {
    @Prop({enum: ["private", "group"], required: true})
    type!: "private" | "group";

    @Prop({default: null})
    name?: string;

    @Prop({type: Types.ObjectId, ref: "User", required: true})
    createdBy!: Types.ObjectId;

    @Prop({
        type: [
            {
                userId: {type: Types.ObjectId, ref: "User"},
                role: {type: String, enum: ["owner", "admin", "member"]},
            },
        ],
        required: true,
    })
    participants!: {
        userId: Types.ObjectId,
        role: "owner" | "admin" | "member",
    }[];

    @Prop({type: Types.ObjectId, ref: "Message"})
    lastMessage!: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({updatedAt: -1});
ConversationSchema.index({_id: 1, "participants.userId": 1});
ConversationSchema.index({type: 1, "participants.userId": 1});
ConversationSchema.index({"participants.userId": 1, updatedAt: -1});
ConversationSchema.index({"participants.userId": 1});