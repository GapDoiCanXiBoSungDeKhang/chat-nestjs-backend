import {forwardRef, Inject, Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {Message, MessageDocument} from "./schema/message.schema";
import {ConversationService} from "../conversation/conversation.service";

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,

        @Inject(forwardRef(() => ConversationService))
        private readonly conversationService: ConversationService,
    ) {}

    public async create(
        userId: Types.ObjectId,
        conversationId: Types.ObjectId,
        content: string,
    ) {
        const message = await this.messageModel.create({
            conversationId: conversationId,
            senderId: userId,
            seenBy: [userId],
            content
        });
        await this.conversationService
            .updateConversation(
                conversationId,
                message._id
            );
        return message;
    }

    public async messages(conversationId: Types.ObjectId) {
        return this.messageModel.find({conversationId: conversationId})
            .populate("senderId", "name avatar status")
            .sort({createdAt: 1})
            .lean();
    }

    public async filterMessageConversationNotSeen(
        conversationIds: Types.ObjectId[],
        userId: Types.ObjectId,
    ) {
        const filter = await this.messageModel.find({
            conversationId: {$in: conversationIds},
            seenBy: {$ne: userId}
        }, {
            conversationId: 1,
        });
        return filter.map(mgs => mgs.conversationId);
    }
}