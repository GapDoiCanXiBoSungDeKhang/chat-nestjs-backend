import {ForbiddenException, forwardRef, HttpException, Inject, Injectable, NotFoundException} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {Message, MessageDocument} from "./schema/message.schema";
import {ConversationService} from "../conversation/conversation.service";
import {NotificationService} from "../notification/notification.service";
import {ChatGateway} from "../chat/chat.gateway";

import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,

        @Inject(forwardRef(() => ConversationService))
        private readonly conversationService: ConversationService,
        private readonly notificationService: NotificationService,
        private readonly chatGateway: ChatGateway,
    ) {}

    public async create(
        userId: string,
        conversationId: string,
        content: string,
        type: "text" | "file" | "image" | "forward",
        replyTo?: string,
    ) {
        const convObjectId = convertStringToObjectId(conversationId);
        const userObjectId = convertStringToObjectId(userId);

        const data: MessageDocument = {
            conversationId: convObjectId,
            senderId: userObjectId,
            seenBy: [userObjectId],
            type,
            content,
            ...(replyTo && {replyTo: convertStringToObjectId(replyTo)}),
        }

        const message = await this.messageModel.create(data);
        await message.populate([
            {path: "senderId", select: "name avatar"},
            {
                path: "replyTo", select: "content senderId",
                populate: {path: "senderId", select: "name avatar"}
            },
            {
                path: "reactions",
                populate: {path: "userId", select: "name avatar"}
            },
            {path: "seenBy", select: "name avatar"}
        ]);

        await this.conversationService.updateConversation(conversationId, message._id.toString());
        this.chatGateway.emitNewMessage(conversationId, message);

        const receiverId = await this.conversationService.getUserParticipant(conversationId, userId);
        setImmediate(() => {
            this.notificationService.create({
                userId: receiverId,
                type: "message",
                refId: convObjectId,
                payload: {
                    conversationId: convObjectId,
                    senderId: userObjectId,
                    contend: message.content.slice(0, 30),
                },
            });
        });

        return message;
    }

    public async edit(
        userId: string,
        content: string,
        id: string
    ) {
        const findMessage = await this.findById(id);
        if (!findMessage) {
            throw new NotFoundException("message not found!");
        }
        if (findMessage.senderId.toString() !== userId) {
            throw new ForbiddenException("Can't edit message");
        }
        findMessage.content = content
        findMessage.editedAt = new Date();
        findMessage.isEdited = true;
        await findMessage.save();

        this.chatGateway.emitMessageEdited(
            findMessage.conversationId.toString(),
            findMessage
        );

        return findMessage;
    }

    public async messages(conversationId: string) {
        return this.messageModel.find({conversationId: convertStringToObjectId(conversationId)})
            .populate([
                {path: "senderId", select: "name avatar"},
                {
                    path: "replyTo", select: "content senderId",
                    populate: {path: "senderId", select: "name avatar"}
                },
                {
                    path: "reactions",
                    populate: {path: "userId", select: "name avatar"}
                },
                {path: "seenBy", select: "name avatar"}
            ])
            .sort({createdAt: 1})
            .lean();
    }

    public async findById(messageId: string) {
        return this.messageModel.findById(convertStringToObjectId(messageId))
            .populate([
                {path: "senderId", select: "name avatar"},
                {
                    path: "replyTo", select: "content senderId",
                    populate: {path: "senderId", select: "name avatar"}
                },
                {
                    path: "reactions",
                    populate: {path: "userId", select: "name avatar"}
                },
                {path: "seenBy", select: "name avatar"}
            ]);
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

        const messageEdit = await this.findById(messageId);

        return messageEdit;
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

    public async delete(
        conversationId: string,
        id: string,
        userId: string,
        scope: "self" | "everyone",
    ) {
        const objectId = convertStringToObjectId(id);
        const userObjectId = convertStringToObjectId(userId);

        try {
            let result = null;
            if (scope === "self") {
                result = await this.messageModel.findOneAndUpdate(
                    {
                        _id: objectId,
                        deletedFor: { $ne: userObjectId },
                    },
                    {
                        $addToSet: {
                            deletedFor: userObjectId,
                        },
                    },
                    { new: true },
                );
            }
            if (scope === "everyone") {
                result = await this.messageModel.findOneAndUpdate(
                    {
                        _id: objectId,
                        senderId: userObjectId,
                        isDeleted: { $ne: true },
                    },
                    {
                        $set: {
                            isDeleted: true,
                            content: "Message deleted",
                        },
                    },
                    { new: true },
                );
            }

            if (!result) {
                throw new ForbiddenException("You are not allowed to delete this message");
            }
            this.chatGateway.emitMessageDeleted(conversationId, {
                messageId: result._id.toString(),
                scope: scope,
                deletedBy: userId
            });
            return result;
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    public async forwardMessage(
        userId: string,
        id: string,
        conversationIds: string[],
    ) {
        const originalMessage = await this.findById(id);
        if (!originalMessage) {
            throw new NotFoundException("message not found!");
        }
        const userObjectId = convertStringToObjectId(userId);

        const conversations = await this.conversationService.conversationsIds(conversationIds);
        if (!conversations.length) {
            throw new ForbiddenException("Nothing conversation active!");
        }

        const receiverMap = new Map<string, Types.ObjectId>();
        for (const conv of conversations) {
            const other = conv.participants.find(
                p => p.userId.toString() !== userId
            );
            receiverMap.set(conv._id.toString(), other!.userId);
        }

        const docs = conversations.map(conv => ({
            conversationId: conv._id,
            senderId: userObjectId,
            type: "forward",
            content: originalMessage.content,
            forwardedFrom: originalMessage._id,
            seenBy: [userObjectId],
        }));
        const messages = await this.messageModel.insertMany(docs);

        await Promise.all(
            messages.map(m =>
                this.conversationService.updateConversation(
                    m.conversationId.toString(),
                    m._id.toString(),
                ),
            ),
        );

        setImmediate(() => {
            for (const m of messages) {
                const receiverId = receiverMap.get(
                    m.conversationId.toString()
                );
                if (!receiverId) return;

                this.notificationService.create({
                    userId: receiverId,
                    type: "message",
                    refId: m.conversationId,
                    payload: {
                        conversationId: m.conversationId,
                        senderId: userObjectId,
                        contend: originalMessage.content?.slice(0, 30),
                    },
                });
            }
        });

        return messages;
    }
}