import {SchemaFactory, Schema, Prop} from "@nestjs/mongoose";
import {Document, Types} from "mongoose";

export type RequestJoinRoomDocument = Document & RequestJoinRoom;

@Schema({timestamps: true})
export class RequestJoinRoom {
    @Prop({type: Types.ObjectId, ref: "User", required: true})
    userId!: Types.ObjectId;

    @Prop({
        type: String,
        enum: ["pending", "accept", "reject"],
        default: "pending",
    })
    status!: "pending" | "reject" | "accept";

    @Prop({type: Types.ObjectId, ref: "User", required: true})
    actor!: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: "Conversation", required: true})
    conversationId!: Types.ObjectId;

    @Prop({type: String, default: ""})
    description!: string;
}

export const RequestJoinRoomSchema = SchemaFactory.createForClass(RequestJoinRoom);

RequestJoinRoomSchema.index({conversationId: 1, createdAt: 1});
RequestJoinRoomSchema.index(
    { userId: 1, conversationId: 1 },
    { unique: true, partialFilterExpression: { status: "pending" } }
);
