import {forwardRef, HttpException, Inject, Injectable, NotFoundException} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {Message, MessageDocument} from "./schema/message.schema";
import {ConversationService} from "../conversation/conversation.service";
import {NotificationService} from "../notification/notification.service";

import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,

        @Inject(forwardRef(() => ConversationService))
        private readonly conversationService: ConversationService,
        private readonly notificationService: NotificationService,
    ) {}

    public async create(
        userId: string,
        conversationId: string,
        content: string,
        replyTo?: string,
    ) {
        const convObjectId = convertStringToObjectId(conversationId);
        const userObjectId = convertStringToObjectId(userId);

        const data: MessageDocument = {
            conversationId: convObjectId,
            senderId: userObjectId,
            seenBy: [userObjectId],
            content
        }
        if (replyTo) {
            const findMessage = await this.findById(replyTo);
            if (!findMessage) {
                throw new NotFoundException("Reply not fount message");
            }
            data.replyTo = convertStringToObjectId(replyTo);
        }

        const message = await this.messageModel.create(data);
        await message.populate("senderId", "name avatar");
        await this.conversationService
            .updateConversation(
                conversationId,
                message._id.toString()
            );

        const receiverId = await this.conversationService
            .getUserParticipant(
                conversationId,
                userId
            );
        await this.notificationService.create({
            userId: receiverId,
            type: "message",
            refId: convertStringToObjectId(conversationId),
            payload: {
                conversationId: convertStringToObjectId(conversationId),
                senderId: convertStringToObjectId(userId),
                contend: message.content.slice(0, 30)
            }
        })
        return message;
    }

    public async messages(conversationId: string) {
        return this.messageModel.find({conversationId: convertStringToObjectId(conversationId)})
            .populate("senderId", "name avatar status")
            .sort({createdAt: 1})
            .lean();
    }

    public async findById(messageId: string) {
        return this.messageModel.findById(convertStringToObjectId(messageId));
    }

    public async react(
        messageId: string,
        userId: string,
        emoji: string,
    ) {
        const messageObjectId = convertStringToObjectId(messageId);
        const userObjectId = convertStringToObjectId(userId);

        const updated = await this.messageModel.updateOne(
            {
                _id: messageObjectId,
                "reactions.userId": userObjectId
            },
            {
                $set: {
                    "reactions.$.emoji": emoji
                },
            }
        );

        if (updated.matchedCount === 0) {
            await this.messageModel.findByIdAndUpdate(
                messageObjectId,
                {
                    $addToSet: {
                        reactions: {
                            userId: userObjectId,
                            emoji
                        },
                    },
                },
            );
        }

        return this.findById(messageId);
    }


    public async filterMessageConversationNotSeen(
        conversationIds: Types.ObjectId[],
        userId: string,
    ) {
        const filter = await this.messageModel.find({
            conversationId: {$in: conversationIds},
            seenBy: {$ne: convertStringToObjectId(userId)}
        }, {
            conversationId: 1,
        });
        return filter.map(mgs => mgs.conversationId);
    }

    public async markAsSeen(
        conversationId: string,
        userId: string,
    ) {
        await this.messageModel.updateMany({
            conversationId: convertStringToObjectId(conversationId),
            seenBy: {$ne: convertStringToObjectId(userId)}
        }, {
            $addToSet: {seenBy: convertStringToObjectId(userId)}
        });
        return {success: true};
    }
}