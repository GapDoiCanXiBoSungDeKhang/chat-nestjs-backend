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
import {ChatGateway} from "../../gateway/chat.gateway";
import {AttachmentService} from "../attachment/attachment.service";
import {LinkPreviewService} from "../link-preview/link-preview.service";
import {UserService} from "../user/user.service";

import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";
import {extractValidUrls} from "../../shared/utils/extractUrl.util";

import {RedisCacheService} from "../../shared/redis/redisCache.service";

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,
        @Inject(forwardRef(() => ConversationService))
        private readonly conversationService: ConversationService,
        private readonly attachmentService: AttachmentService,
        private readonly linkPreviewService: LinkPreviewService,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        @Inject(forwardRef(() => ChatGateway))
        private readonly chatGateway: ChatGateway,
        private readonly redisCacheService: RedisCacheService,
    ) {
    }

    private async buildReplyTo(replyTo?: string) {
        if (!replyTo) return undefined;
        const message = await this.messageModel.findById(
            convertStringToObjectId(replyTo),
            {_id: 1}
        );
        if (!message) throw new NotFoundException("Reply message not found");
        return convertStringToObjectId(replyTo);
    }

    /**
     * Invalidate toàn bộ cache liên quan đến conversation:
     * - Message pages của conversation
     * - Conversation list của tất cả participants
     *
     * Tất cả lỗi cache đều bị nuốt — không để ảnh hưởng flow chính.
     */
    private async invalidateAll(conversationId: string): Promise<void> {
        try {
            // 1. Xoá tất cả message pages của conversation này
            await this.redisCacheService.invalidateMessages(conversationId);
 
            // 2. Xoá conversation list cache của tất cả participants
            const conversation = await this.conversationService.findConversation(conversationId);
            const participantIds = conversation.participants.map((p) => p.userId.toString());
            await this.redisCacheService.invalidateConversationsMany(participantIds);
        } catch {
            // Không để lỗi cache làm hỏng flow chính
        }
    }
 
    // ─── Gửi message text ────────────────────────────────────────────────────

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
        mentions?: string[],
    ) {
        const convObjectId = convertStringToObjectId(conversationId);
        const senderId = convertStringToObjectId(userId);

        const replyToObjectId = await this.buildReplyTo(replyTo);
        const validateMentions = await this.conversationService.validateMentions(
            conversationId, mentions
        );

        const message = await this.messageModel.create({
            conversationId: convObjectId,
            senderId,
            seenBy: [senderId],
            type: "text",
            content,
            mentions: validateMentions,
            ...(replyToObjectId && {replyTo: replyToObjectId}),
        });
        await message.populate(this.getArrayPopulate());
        this.chatGateway.emitNewMessage(conversationId, message);

        const urls = extractValidUrls(content);
        if (urls.length) {
            const getLinks = (await Promise.all(
                urls.map(url => this.linkPreviewService.fetchLink(url, message.id, conversationId, userId)),
            )).filter(Boolean);
            if (getLinks.length) {
                this.chatGateway.emitNewMessageLinkPreview(conversationId, getLinks);
            }
        }
        if (mentions?.length) {
            this.chatGateway.emitMentions(validateMentions, {
                message,
                conversation: conversationId,
                mentions: mentions || [],
            });
        }
        await this.conversationService.updateConversation(conversationId, message.id);
        // [CACHE] Invalidate message pages + conversation list vì có message mới
        await this.invalidateAll(conversationId);
        return {message};
    }

    public async search(q: string, conversationId: string) {
        const conversationObjectId = convertStringToObjectId(conversationId);

        if (!q || !q.trim().length) {
            return [];
        }
        const res = await this.messageModel.find(
            {
                $text: {$search: q},
                conversationId: conversationObjectId,
                isDeleted: true
            },
            {score: {$meta: "textScore"}}
        )
            .sort({score: {$meta: "textScore"}})
            .limit(20);
        return res;
    }

    public async pin(
        messageId: string,
        userId: string,
        conversationId: string
    ) {
        const mgs = await this.messageModel.findById(convertStringToObjectId(messageId));
        if (!mgs) throw new NotFoundException("Message not found");
        if (mgs.isPinned) throw new ForbiddenException("Message already pinned");

        mgs.isPinned = true;
        mgs.pinByUser = convertStringToObjectId(userId);
        mgs.pinnedAt = new Date();
        await mgs.save();

        this.chatGateway.emitMessagePinned(conversationId, {
            messageId: mgs.id,
            isPinned: true,
            pinByUser: mgs.pinByUser,
            pinnedAt: mgs.pinnedAt.toISOString(),
        });

        // [CACHE] Invalidate vì isPinned của message thay đổi
        await this.redisCacheService.invalidateMessages(conversationId);
        return mgs;
    }

    public async unpin(
        messageId: string,
        userId: string,
        conversationId: string
    ) {
        const mgs = await this.messageModel.findById(convertStringToObjectId(messageId));
        if (!mgs) throw new NotFoundException("Message not found");
        if (!mgs.isPinned) throw new ForbiddenException("Message already not pinned");
        if (!mgs.pinByUser || mgs.pinByUser.toString() !== userId) {
            throw new ForbiddenException("You are not user pin this message!")
        }
        mgs.isPinned = false;
        mgs.pinByUser = null;
        mgs.pinnedAt = null;
        await mgs.save();

        this.chatGateway.emitMessageUnpinned(conversationId, {
            messageId: mgs.id,
            isPinned: false,
            pinByUser: null,
            pinnedAt: null,
        });

        // [CACHE] Invalidate vì isPinned của message thay đổi
        await this.redisCacheService.invalidateMessages(conversationId);
        return mgs;
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
        await this.conversationService.updateConversation(conversationId, message.id);

        // [CACHE] Invalidate
        await this.invalidateAll(conversationId);
        return {message, attachments};
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
            ...(replyToObjectId && {replyTo: replyToObjectId}),
        });
        await message.populate(this.getArrayPopulate());

        const attachments = await this.attachmentService.uploadMedias(
            files, message.id, userId, conversationId
        );
        this.chatGateway.emitNewMessageMedias(conversationId, {message, attachments});
        await this.conversationService.updateConversation(conversationId, message.id);

        // [CACHE] Invalidate
        await this.invalidateAll(conversationId);
        return {message, attachments};
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
            ...(replyToObjectId && {replyTo: replyToObjectId}),
        });
        await message.populate(this.getArrayPopulate());

        const attachments = await this.attachmentService.uploadVoice(
            file, message.id, userId, conversationId
        );
        this.chatGateway.emitNewMessageVoice(conversationId, {message, attachments});
        await this.conversationService.updateConversation(conversationId, message.id);

        // [CACHE] Invalidate
        await this.invalidateAll(conversationId);
        return {message, attachments};
    }

    public async edit(
        userId: string,
        content: string,
        id: string
    ) {
        const message = await this.messageModel.findById(convertStringToObjectId(id));
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

        this.chatGateway.emitMessageEdited(message.conversationId.toString(), populated);

        // [CACHE] Invalidate vì nội dung message đã thay đổi
        await this.redisCacheService.invalidateMessages(message.conversationId.toString());
        return populated;
    }

     // ─── GET messages — CACHE-ASIDE ──────────────────────────────────────────
 
    /**
     * [CACHE] Cache-aside pattern cho message pagination.
     *
     * Flow:
     *   1. Tạo cache key theo (conversationId, limit, before)
     *   2. Cache HIT  → trả về ngay, không query MongoDB
     *   3. Cache MISS → query MongoDB + enrich attachments/links → lưu cache → trả về
     *
     * TTL: 60 giây.
     * Invalidate: bất cứ khi nào có write trong conversation (gửi, edit, delete, react, seen).
     *
     * Tại sao cursor-based key?
     *   Mỗi "page" có cursor khác nhau (before = ObjectId của message cuối page trước).
     *   Cache theo cursor để các page cũ (đã load xong) vẫn hit cache dù có message mới ở trang 1.
     *   Khi có write → invalidate tất cả pages → client tự refresh trang 1.
     */
    public async messages(
        conversationId: string,
        limit: number = 20,
        before?: string
    ) {
        // 1. Thử lấy từ cache
        const cached = await this.redisCacheService.getMessages(conversationId, limit, before);
        if (cached) return cached;
 
        // 2. Cache miss — query MongoDB
        const query: any = {conversationId: convertStringToObjectId(conversationId)};
        if (before) query._id = {$lt: convertStringToObjectId(before)};
        const messages = await this.messageModel
            .find(query)
            .populate([
                {path: "senderId", select: "name avatar"},
                {
                    path: "replyTo",
                    select: "content senderId",
                    populate: {path: "senderId", select: "name avatar"}
                },
                {path: "deletedFor", select: "name avatar"},
                {path: "seenBy", select: "name avatar"}
            ])
            .sort({createdAt: -1})
            .limit(limit)
            .lean();

        const messageIdsAttachments = messages
            .filter(m => ["file", "media", "voice"].includes(m.type))
            .map(m => m._id);
        const messageIds = messages.map(m => m._id);

        const [groupAttachments, groupLinks] = await Promise.all([
            this.attachmentService.groupAttachmentsById(messageIdsAttachments),
            this.linkPreviewService.groupLinkPreviewsById(messageIds),
        ]);

        const enriched = messages.map(m => {
            const id = m._id.toString();
            if (groupAttachments[id]) {
                m.attachments =
                    m.type === "voice" ? [groupAttachments[id][0]]: groupAttachments[id];
            }
            if (groupLinks[id]) m.linkPreviews = groupLinks[id];
            return m;
        });

        const result = {
            messages: enriched.reverse(),
            nextCursor: enriched.length ? enriched[0]._id : null,
            hasMore: enriched.length === limit,
        };
 
        // 3. Lưu vào cache 60 giây
        await this.redisCacheService.setMessages(conversationId, limit, result, before);
        return result;
    }

    public async findByIdCheck(messageId: string) {
        return this.messageModel.findById(
            convertStringToObjectId(messageId),
            {conversationId: 1}
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
            {_id: messageObjectId, "reactions.userId": userObjectId},
            {$set: {"reactions.$.emoji": emoji}}
        );

        if (updated.matchedCount === 0) {
            await this.messageModel.findByIdAndUpdate(
                messageObjectId,
                {$addToSet: {reactions: {userId: userObjectId, emoji}}},
            );
        }

        const messageEdit = await this.messageModel.findById(messageObjectId);
        if (!messageEdit) throw new ConflictException("message not found!");

        this.chatGateway.emitMessageReacted(messageEdit.conversationId.toString(), {
            messageId, userId, emoji, action: "add"
        });

        // [CACHE] Invalidate vì reactions của message thay đổi
        await this.redisCacheService.invalidateMessages(
            messageEdit.conversationId.toString(),
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
            {_id: messageObjectId, "reactions.userId": userObjectId},
            {$pull: {reactions: {userId: userObjectId}}},
            {new: true},
        );
        if (!message) throw new NotFoundException("Reaction not found");
        this.chatGateway.emitMessageReacted(message.conversationId.toString(), {
            messageId, userId, emoji: null, action: "remove"
        });

        // [CACHE] Invalidate vì reactions thay đổi
        await this.redisCacheService.invalidateMessages(message.conversationId.toString());
        return message;
    }

    /**
     * FIX [PERFORMANCE - N+1]: Thay thế filterMessageConversationNotSeen bằng aggregation pipeline.
     * Hàm cũ load toàn bộ message IDs rồi đếm phía app — với 50 groups x 10k messages = 500k documents.
     * Hàm mới dùng $group trong MongoDB, chỉ trả về [{_id: conversationId, count: number}].
     */
    public async getUnreadCountsPerConversation(
        conversationIds: Types.ObjectId[],
        userId: string,
    ): Promise<{_id: Types.ObjectId; count: number}[]> {
        const userObjId = convertStringToObjectId(userId);
        return this.messageModel.aggregate([
            {
                $match: {
                    conversationId: {$in: conversationIds},
                    seenBy: {$ne: userObjId},
                    isDeleted: false,
                }
            },
            {$group: {_id: "$conversationId", count: {$sum: 1}}}
        ]);
    }

    public async markAsSeen(
        conversationId: string,
        userId: string,
    ) {
        const conObjectId = convertStringToObjectId(conversationId);
        const userObjectId = convertStringToObjectId(userId);

        await this.messageModel.updateMany(
            {conversationId: conObjectId, seenBy: { $ne: userObjectId }},
            {$addToSet: { seenBy: userObjectId }},
        );

        const lastMessage = await this.messageModel
            .findOne({ conversationId: conObjectId })
            .sort({ createdAt: -1 })
            .lean();

        if (!lastMessage) return { success: false };

        const userInfo = await this.userService.getInfoById(userId);
        this.chatGateway.emitMessageSeen(conversationId, {
            conversationId,
            messageId: lastMessage._id.toString(),
            seenBy: userInfo,
        });

        // [CACHE] seenBy thay đổi → invalidate message pages + conversation list
        await Promise.all([
            this.redisCacheService.invalidateMessages(conversationId),
            this.redisCacheService.invalidateConversations(userId),
        ]);
        return { success: true };
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
                    {_id: objectId, deletedFor: {$ne: userObjectId}},
                    {$addToSet: {deletedFor: userObjectId}},
                    {new: true},
                );
            }
            if (scope === "everyone") {
                result = await this.messageModel.findOneAndUpdate(
                    {_id: objectId, senderId: userObjectId, isDeleted: {$ne: true}},
                    {$set: {isDeleted: true, content: "Message deleted"}},
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

            // [CACHE] Invalidate vì message bị xoá (isDeleted / deletedFor thay đổi)
            await this.redisCacheService.invalidateMessages(conversationId);
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

        if (!originalMessage) throw new NotFoundException("message not found!");
        if (originalMessage.isDeleted) {
            throw new ForbiddenException("Cannot forward this message!");
        }

        const userObjectId = convertStringToObjectId(userId);

        const conversations = await this.conversationService.conversationsIdsForUser(conversationIds, userId);
        if (!conversations.length) {
            throw new ForbiddenException("Nothing conversation active!");
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
                this.chatGateway.emitMessageForwarded(m.conversationId.toString(), m);

                // [CACHE] Invalidate từng conversation đích
                await this.invalidateAll(m.conversationId.toString());
            }),
        );
        return messages;
    }

    public async newMessageSystem(
        actorId: string,
        content: string,
        userIds: string[],
        conversationId: string,
    ) {
        const convObjectId = convertStringToObjectId(conversationId);
        const userObjectId = convertStringToObjectId(actorId);

        const users = await this.userService.getInfoUserIds(userIds);

        const dataMap = users.map((user) => ({
            type: "system",
            content: `${content} ${user.name}!`,
            senderId: userObjectId,
            conversationId: convObjectId,
            seenBy: [userObjectId],
        }));

        const result = await this.messageModel.insertMany(dataMap);
 
        // [CACHE] System message cũng invalidate pages
        await this.redisCacheService.invalidateMessages(conversationId);
        return result;
    }

    public async deleteManyMessagesConversationGroup(
        conversationId: string,
    ) {
        const convObjectId = convertStringToObjectId(conversationId);
        await this.messageModel.deleteMany({conversationId: convObjectId});
        
         // [CACHE] Xoá toàn bộ cache của conversation khi group bị xoá
        await this.redisCacheService.invalidateMessages(conversationId);
    }

    public async filterMessageHavePins(conversationId: string) {
        return this.messageModel.find({
            conversationId: convertStringToObjectId(conversationId),
            isPinned: true
        })
            .populate(this.getArrayPopulate())
            .sort({createdAt: -1})
            .lean();
    }
}