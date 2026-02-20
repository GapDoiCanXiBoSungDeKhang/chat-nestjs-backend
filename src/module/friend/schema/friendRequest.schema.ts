import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Document, Types} from "mongoose";

export type FriendRequestDocument = Document & FriendRequest;

@Schema({timestamps: true})
export class FriendRequest {
    @Prop({type: Types.ObjectId, ref: "User", required: true})
    from!: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: "User", required: true})
    to!: Types.ObjectId;

    @Prop({
        type: String,
        required: true,
        max: 300
    })
    message!: string;

    @Prop({
        enum: ["pending", "accepted", "rejected"],
        default: "pending"
    })
    status!: "pending" | "reject" | "accept";
}

export const FriendRequestSchema = SchemaFactory.createForClass(FriendRequest);

FriendRequestSchema.index({from: 1, to: 1}, {unique: true});
FriendRequestSchema.index({to: 1, status: 1, updatedAt: -1});
FriendRequestSchema.index({from: 1, status: 1, updatedAt: -1});
