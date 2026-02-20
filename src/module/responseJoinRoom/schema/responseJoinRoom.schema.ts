import {SchemaFactory, Schema, Prop} from "@nestjs/mongoose";
import {Document, Types} from "mongoose";

export type ResponseJoinRoomDocument = Document & ResponseJoinRoom;

@Schema({timestamps: true})
export class ResponseJoinRoom {
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

export const ResponseJoinRoomSchema = SchemaFactory.createForClass(ResponseJoinRoom);

ResponseJoinRoomSchema.index({conversationId: 1, createdAt: 1});