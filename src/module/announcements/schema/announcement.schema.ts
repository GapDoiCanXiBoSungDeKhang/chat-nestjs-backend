import {Schema, SchemaFactory, Prop} from "@nestjs/mongoose";
import {Document} from "mongoose";
import {Types} from "mongoose";

export type AnnouncementDocument = Announcement & Document;

@Schema({timestamps: true})
export class Announcement {
    @Prop({type: Types.ObjectId, ref: "Conversation", required: true})
    conversationId!: Types.ObjectId;

    @Prop({type: String, required: true})
    content!: string;

    @Prop({type: Types.ObjectId, ref: "User", required: true})
    pinnedBy!: Types.ObjectId;

    @Prop({type: String, enum: ["active", "inactive"], default: "inactive"})
    status!: "active" | "inactive";
}

export const announcementSchema = SchemaFactory.createForClass(Announcement);

announcementSchema.index({conversationId: 1, createdAt: -1});
announcementSchema.index({pinnedBy: 1, createdAt: -1});
announcementSchema.index({conversationId: 1, status: 1});