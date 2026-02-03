import {forwardRef, Inject, Injectable, NotFoundException} from "@nestjs/common";
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
    ) {
        const message = await this.messageModel.create({
            conversationId: convertStringToObjectId(conversationId),
            senderId: convertStringToObjectId(userId),
            seenBy: [convertStringToObjectId(userId)],
            content
        });
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
        idMessage: string,
        userId: string,
        emoji: string,
    ) {
        const findMessage = await this.findById(idMessage);
        if (!findMessage) {
            throw new NotFoundException("Not found message!");
        }
        const posReact = findMessage.reactions.findIndex(
            obj => obj.userId.toString() === userId
        );
        const objReact = {
            userId: convertStringToObjectId(userId),
            emoji,
        };
        if (posReact === -1) {
            findMessage.reactions.push(objReact);
        } else {
            findMessage.reactions[posReact].emoji = emoji;
        }

        await findMessage.save();
        return findMessage;
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