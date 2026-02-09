import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type LinkPreviewDocument = LinkPreview & Document;

@Schema({ timestamps: true })
export class LinkPreview {
    @Prop({ type: Types.ObjectId, ref: "Message", required: true })
    messageId!: Types.ObjectId;

    @Prop({ type: String, required: true })
    url!: string;

    @Prop({ type: String })
    title?: string;

    @Prop({ type: String })
    description?: string;

    @Prop({ type: String })
    image?: string;
}

export const LinkPreviewSchema = SchemaFactory.createForClass(LinkPreview);
