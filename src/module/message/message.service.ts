import {
    ConflictException,
    ForbiddenException,
    forwardRef,
    Inject,
    Injectable,
    NotFoundException
} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {Message, MessageDocument} from "./schema/message.schema";
import {ConversationService} from "../conversation/conversation.service";
import {NotificationService} from "../notification/notification.service";
import {ChatGateway} from "../../gateway/chat.gateway";
import {AttachmentService} from "../attachment/attachment.service";
import {LinkPreviewService} from "../link-preview/link-preview.service";

import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";
import {extractValidUrls} from "../../shared/ultis/extractUrl.ulti";

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,
        @Inject(forwardRef(() => ConversationService))
        private readonly conversationService: ConversationService,
        private readonly notificationService: NotificationService,
        private readonly attachmentService: AttachmentService,
        private readonly linkPreviewService: LinkPreviewService,
        private readonly chatGateway: ChatGateway,
    ) {
    }

    private async buildReplyTo(replyTo?: string) {
        if (!replyTo) return undefined;

        const message = await this.messageModel.findById(
            convertStringToObjectId(replyTo),
            { _id: 1 }
        );

        if (!message) throw new NotFoundException("Reply message not found");

        return convertStringToObjectId(replyTo);
    }

    private getArrayPopulate() {
        return [
            {path: "senderId", select: "name avatar"},
            {
                path: "replyTo", select: "content senderId",
                populate: {path: "senderId", select: "name avatar"}
            },
            {path: "seenBy", select: "name avatar"}
        ]
    }

    public async create(
        userId: string,
        conversationId: string,
        content: string,
        replyTo?: string,
    ) {
        const convObjectId = convertStringToObjectId(conversationId);
        const senderId = convertStringToObjectId(userId);

        const replyToObjectId = await this.buildReplyTo(replyTo);
        let getLinks;

        const message = await this.messageModel.create({
            conversationId: convObjectId,
            senderId,
            seenBy: [senderId],
            type: "text",
            content,
            ...(replyToObjectId && {replyTo: replyToObjectId}),
        });
        await message.populate(this.getArrayPopulate());
        const urls = extractValidUrls(content);
        if (urls.length) {
            getLinks = await Promise.all(
                urls.map(url =>
                    this.linkPreviewService.fetchLink(
                        url,
                        message.id,
                        conversationId,
                        userId,
                    )
                ),
            );
        }
        this.chatGateway.emitNewMessage(conversationId, message);
        this.chatGateway.emitNewMessageLinkPreview(conversationId, getLinks);

        await this.conversationService.updateConversation(
            conversationId,
            message.id
        );
        await this.Notification(conversationId, message, userId);

        return {message, getLinks};
    }

    public async search(q: string, conversationId: string) {
        const conversationObjectId = convertStringToObjectId(conversationId);

        if (!q || !q.trim().length) {
            return [];
        }
        const res = await this.messageModel.find(
            {
                $text: {$search: q},
                conversationId: conversationObjectId
            },
            {score: {$meta: "textScore"}}
        )
            .sort({score: {$meta: "textScore"}})
            .limit(20);
        return res;
    }

    public async pin(messageId: string, userId: string) {
        const mgs = await this.messageModel.findById(convertStringToObjectId(messageId));
        if (!mgs) throw new NotFoundException("Message not found");
        if (mgs.isPinned) throw new ForbiddenException("Message already pinned");

        mgs.isPinned = true;
        mgs.pinByUser = convertStringToObjectId(userId);
        mgs.pinnedAt = new Date();
        await mgs.save();
        return mgs;
    }

    public async unpin(messageId: string, userId: string) {
        const mgs = await this.messageModel.findById(convertStringToObjectId(messageId));
        if (!mgs) throw new NotFoundException("Message not found");
        if (!mgs.isPinned) throw new ForbiddenException("Message already not pinned");
        if (!mgs.pinByUser || mgs.pinByUser.toString() !== userId) {
            throw new ForbiddenException("You are not user pin this message!")
        }
        mgs.isPinned = false;
        mgs.pinByUser = null;
        await mgs.save();
        return mgs;
    }

    private async Notification(
        conversationId: string,
        message: MessageDocument,
        userId: string,
    ) {
        const receiverId = await this.conversationService.getUserParticipant(conversationId, userId);
        setImmediate(() => {
            this.notificationService.create({
                userId: receiverId,
                type: "message",
                refId: message.conversationId,
                payload: {
                    conversationId: message.conversationId,
                    senderId: userId,
                    content: message.content?.slice(0, 30),
                },
            });
        });
    }

    public async uploadFiles(
        files: Express.Multer.File[],
        conversationId: string,
        userId: string,
        replyTo?: string,
    ) {
        const convObjectId = convertStringToObjectId(conversationId);
        const senderId = convertStringToObjectId(userId);

        const replyToObjectId = await this.buildReplyTo(replyTo);

        const message = await this.messageModel.create({
            conversationId: convObjectId,
            senderId,
            seenBy: [senderId],
            attachmentCount: files.length,
            type: "file",
            ...(replyToObjectId && {replyTo: replyToObjectId}),
        });
        await message.populate(this.getArrayPopulate());

        const attachments = await this.attachmentService.uploadFiles(
            files,
            message.id,
            userId,
            conversationId
        );
        this.chatGateway.emitNewMessageFiles(conversationId, {message, attachments});

        await this.conversationService.updateConversation(
            conversationId,
            message.id
        );
        await this.Notification(conversationId, message, userId);

        return { message, attachments };
    }

    public async uploadMedias(
        files: Express.Multer.File[],
        conversationId: string,
        userId: string,
        replyTo?: string,
    ) {
        const convObjectId = convertStringToObjectId(conversationId);
        const senderId = convertStringToObjectId(userId);

        const replyToObjectId = await this.buildReplyTo(replyTo);

        const message = await this.messageModel.create({
            conversationId: convObjectId,
            senderId,
            seenBy: [senderId],
            type: "media",
            attachmentCount: files.length,
            ...(replyToObjectId && {replyTo: replyToObjectId}),
        });

        await message.populate(this.getArrayPopulate());

        const attachments = await this.attachmentService.uploadMedias(
            files,
            message.id,
            userId,
            conversationId
        );
        this.chatGateway.emitNewMessageMedias(conversationId, {message, attachments});

        await this.conversationService.updateConversation(
            conversationId,
            message.id
        );
        await this.Notification(conversationId, message, userId);

        return { message, attachments };
    }

    public async uploadVoice(
        file: Express.Multer.File,
        conversationId: string,
        userId: string,
        replyTo?: string,
    ) {
        const convObjectId = convertStringToObjectId(conversationId);
        const senderId = convertStringToObjectId(userId);

        const replyToObjectId = await this.buildReplyTo(replyTo);

        const message = await this.messageModel.create({
            conversationId: convObjectId,
            senderId,
            seenBy: [senderId],
            type: "voice",
            attachmentCount: 1,
            ...(replyToObjectId && {replyTo: replyToObjectId}),
        });

        await message.populate(this.getArrayPopulate());

        const attachments = await this.attachmentService.uploadVoice(
            file,
            message.id,
            userId,
            conversationId
        );
        this.chatGateway.emitNewMessageVoice(conversationId, {message, attachments});

        await this.conversationService.updateConversation(
            conversationId,
            message.id
        );
        await this.Notification(conversationId, message, userId);

        return { message, attachments };
    }

    public async edit(
        userId: string,
        content: string,
        id: string
    ) {
        const message = await this.messageModel.findById(
            convertStringToObjectId(id)
        );

        if (!message) throw new NotFoundException("Message not found");
        if (message.senderId.toString() !== userId) {
            throw new ForbiddenException("Can't edit message");
        }

        message.content = content;
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        const populated = await this.messageModel
            .findById(message._id)
            .populate([
                {path: "senderId", select: "name avatar"},
                {
                    path: "replyTo",
                    select: "content senderId",
                    populate: {path: "senderId", select: "name avatar"},
                },
                {path: "seenBy", select: "name avatar"},
            ]);

        this.chatGateway.emitMessageEdited(
            message.conversationId.toString(),
            populated
        );

        return populated;
    }

    public async messages(conversationId: string) {
        const message = await this.messageModel
            .find({
                conversationId: convertStringToObjectId(conversationId)
            })
            .populate([
                {path: "senderId", select: "name avatar"},
                {
                    path: "replyTo", select: "content senderId",
                    populate: {path: "senderId", select: "name avatar"}
                },
                {path: "deletedFor", select: "name avatar"},
                {path: "seenBy", select: "name avatar"}
            ])
            .sort({createdAt: 1})
            .lean();

        const messageIdsAttachments = message
            .filter(m => ["file", "media", "voice"].includes(m.type))
            .map((m) => m._id);
        const messageIds = message.map((m) => m._id)

        const groupAttachments = await this.attachmentService.groupAttachmentsById(messageIdsAttachments);
        const groupLinks = await this.linkPreviewService.groupLinkPreviewsById(messageIds);

        const messagesWithAttachments = message.map((mgs) => {
            const mgsId = mgs._id.toString();

            if (groupAttachments[mgsId]) {
                mgs.attachments = mgs.type === "voice"
                    ? [groupAttachments[mgsId][0]]
                    : groupAttachments[mgsId];
            }
            if (groupLinks[mgsId]) {
                mgs.linkPreviews = groupLinks[mgsId];
            }

            return mgs;
        });

        return messagesWithAttachments;
    }

    public async findByIdCheck(messageId: string) {
        return this.messageModel.findById(
            convertStringToObjectId(messageId),
            {
                conversationId: 1
            }
        );
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

        const messageEdit = await this.messageModel.findById(messageObjectId);
        if (!messageEdit) {
            throw new ConflictException("message not found!");
        }
        this.chatGateway.emitMessageReacted(
            messageEdit.conversationId.toString(),
            {
                messageId,
                userId,
                emoji,
                action: "add"
            }
        );
        return messageEdit;
    }

    public async unreact(
        messageId: string,
        userId: string,
    ) {
        const messageObjectId = convertStringToObjectId(messageId);
        const userObjectId = convertStringToObjectId(userId);

        const message = await this.messageModel.findOneAndUpdate(
            {
                _id: messageObjectId,
                "reactions.userId": userObjectId,
            },
            {
                $pull: {
                    reactions: {userId: userObjectId},
                },
            },
            {new: true},
        );
        if (!message) {
            throw new NotFoundException("Reaction not found");
        }
        this.chatGateway.emitMessageReacted(
            message.conversationId.toString(),
            {
                messageId,
                userId,
                emoji: null,
                action: "remove"
            }
        );

        return message;
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
        const conObjectId = convertStringToObjectId(conversationId);
        const userObjectId = convertStringToObjectId(userId);

        await this.messageModel.updateMany({
            conversationId: conObjectId,
            seenBy: {$ne: userObjectId}
        }, {
            $addToSet: {seenBy: userObjectId}
        });

        this.chatGateway.emitMessageSeen(conversationId, {
            conversationId,
            userId,
            seenAt: new Date()
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
                        deletedFor: {$ne: userObjectId},
                    },
                    {
                        $addToSet: {
                            deletedFor: userObjectId,
                        },
                    },
                    {new: true},
                );
            }
            if (scope === "everyone") {
                result = await this.messageModel.findOneAndUpdate(
                    {
                        _id: objectId,
                        senderId: userObjectId,
                        isDeleted: {$ne: true},
                    },
                    {
                        $set: {
                            isDeleted: true,
                            content: "Message deleted",
                        },
                    },
                    {new: true},
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
        const objectId = convertStringToObjectId(id);
        const originalMessage = await this.messageModel.findById(objectId);
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
            messages.map(async m => {
                await this.conversationService.updateConversation(
                    m.conversationId.toString(),
                    m._id.toString(),
                );

                await m.populate([
                    {path: "senderId", select: "name avatar"},
                    {path: "seenBy", select: "name avatar"},
                ]);

                this.chatGateway.emitMessageForwarded(
                    m.conversationId.toString(),
                    m,
                );
            }),
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