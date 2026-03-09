import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types} from "mongoose";

export type BlockedUserDocument = BlockedUser & Document;

@Schema({timestamps: true})
export class BlockedUser {
    @Prop({type: Types.ObjectId, ref: "User", required: true})
    blockerId!: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: "User", required: true})
    blockedId!: Types.ObjectId;
}

export const BlockedUserSchema = SchemaFactory.createForClass(BlockedUser);

BlockedUserSchema.index({blockerId: 1, blockedId: 1}, {unique: true});
BlockedUserSchema.index({blockerId: 1});
