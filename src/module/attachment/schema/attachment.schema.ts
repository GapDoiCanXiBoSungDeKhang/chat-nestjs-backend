import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Document, Types} from "mongoose";

export type AttachmentDocument = Attachment & Document;

@Schema({timestamps: true})
export class Attachment {
    @Prop({type: Types.ObjectId, ref: "Message", required: true})
    messageId!: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: "Conversation", required: true})
    conversationId!: Types.ObjectId;

    @Prop({type: Types.ObjectId, ref: "User", required: true})
    uploaderId!: Types.ObjectId;

    @Prop({
        type: String,
        enum: ["image", "video", "file", "voice"],
        required: true,
    })
    type!: string;

    @Prop({type: String, required: true})
    url!: string;

    @Prop({type: String})
    thumbnail?: string;

    @Prop({type: String})
    filename?: string;

    @Prop({type: String})
    originalName?: string;

    @Prop({type: Number})
    size?: number;

    @Prop({type: String})
    mimeType?: string;

    @Prop({type: Number})
    duration?: number;
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

AttachmentSchema.index({conversationId: 1});
AttachmentSchema.index({messageId: 1});