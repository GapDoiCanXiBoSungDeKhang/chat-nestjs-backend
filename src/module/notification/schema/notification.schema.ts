import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Types} from "mongoose";

export type NotificationDocument = Notification & Document;

@Schema({timestamps: true})
export class Notification {
    @Prop({type: Types.ObjectId, ref: "User", required: true})
    userId!: Types.ObjectId;

    @Prop({
        enum: [
            "friend_request",
            "friend_accepted",
            "message",
            "system"
        ],
        required: true
    })
    type!: string;

    @Prop({type: Types.ObjectId})
    refId?: Types.ObjectId;

    @Prop({type: Object})
    payload?: any;

    @Prop({default: false})
    isRead!: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({userId: 1, isRead: 1, createdAt: -1});