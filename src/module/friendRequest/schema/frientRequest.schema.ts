import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Document, Types} from "mongoose";

export type FriendRequestDocument = Document & FriendRequest;

@Schema({ timestamps: true })
export class FriendRequest {
    @Prop({ type: Types.ObjectId, ref: "User", required: true })
    from!: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: "User", required: true })
    to!: Types.ObjectId;

    @Prop({ enum: ["pending", "accepted", "rejected"], default: "pending" })
    status!: string;
}

export const FriendRequestSchema = SchemaFactory.createForClass(FriendRequest);