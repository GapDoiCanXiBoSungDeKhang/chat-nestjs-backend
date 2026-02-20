import {Model} from "mongoose";
import {InjectModel} from "@nestjs/mongoose";
import {
    BadRequestException,
    forwardRef,
    Inject,
    Injectable,
    NotFoundException
} from "@nestjs/common";

import {Conversation, ConversationDocument} from "./schema/conversation.schema";

import {UserService} from "../user/user.service";
import {MessageService} from "../message/message.service";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";
import {AttachmentService} from "../attachment/attachment.service";
import {AttachmentDocument} from "../attachment/schema/attachment.schema";
import {LinkPreviewService} from "../link-preview/link-preview.service";
import {LinkPreviewDocument} from "../link-preview/schema/link-preview.schema";
import {ResponseJoinRoomService} from "../responseJoinRoom/responseJoinRoom.service";

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        private readonly userService: UserService,
        @Inject(forwardRef(() => MessageService))
        private readonly messageService: MessageService,
        private readonly attachmentService: AttachmentService,
        private readonly linkPreviewService: LinkPreviewService,
        private readonly responseJoinRoomService: ResponseJoinRoomService
    ) {
    }

    public async create(myUserId: string, userId: string) {
        const uniqueIds = Array.from(
            new Set([userId, myUserId])
        )
        const ok = await this.checkListUser(uniqueIds);
        if (!ok) {
            throw new BadRequestException(
                "Owner or user not found!"
            )
        }
        const existConversation = await this.conversationModel.findOne({
            type: "private",
            participants: {
                $all: this.convertMapCheckElement(uniqueIds)
            }
        });
        if (existConversation) {
            return existConversation;
        }
        return this.conversationModel.create({
            type: "private",
            createdBy: convertStringToObjectId(myUserId),
            participants: this.groupParticipants(uniqueIds, myUserId)
        });
    }

    private hashTable<T extends AttachmentDocument | LinkPreviewDocument>(
        attachments: T[]
    ): Record<number, Record<number, T[]>> {
        const hashTable: Record<number, Record<number, T[]>> = {};

        for (const att of attachments) {
            const date = new Date(att.createdAt);
            const month = date.getMonth() + 1;
            const year = date.getFullYear();

            if (!hashTable[year]) {
                hashTable[year] = {};
            }
            if (!hashTable[year][month]) {
                hashTable[year][month] = [];
            }
            hashTable[year][month].push(att);
        }

        return hashTable;
    }


    public async infoMediaConversation(id: string) {
        const attachments = await this.attachmentService.getAttachmentRoomMedia(id);
        return this.hashTable(attachments);
    }

    public async infoFileConversation(id: string) {
        const attachments = await this.attachmentService.getAttachmentRoomFile(id);
        return this.hashTable(attachments);
    }

    public async infoLinkPreviewConversation(id: string) {
        const linkPreviews = await this.linkPreviewService.getLinkPreview(id);
        return this.hashTable(linkPreviews);
    }

    public async infoConversation(id: string) {
        const findConversationPrivate = await this.conversationModel.findById(
            convertStringToObjectId(id)
        )
            .populate(this.arrayPopulate())
            .lean();
        if (!findConversationPrivate) {
            throw new NotFoundException("Not found");
        }

        return findConversationPrivate;
    }

    public async isAnyMemberExists(
        conversationId: string,
        members: string[]
    ) {
        const mbObjectIds = members.map(uid => convertStringToObjectId(uid));

        const existingConversation = await this.conversationModel.findOne({
            _id: convertStringToObjectId(conversationId),
            "participants.userId": { $in: mbObjectIds }
        });

        return !!existingConversation;
    }


    public async addMembers(
        room: string,
        ownerId: string,
        userIds: string[],
        description: string,
    ) {
        const uniqueIds = Array.from(
            new Set(userIds)
        );
        const [validUsers, alreadyExists] = await Promise.all([
            this.checkListUser(uniqueIds),
            this.isAnyMemberExists(room, uniqueIds)
        ]);
        if (!validUsers) {
            throw new BadRequestException("Some users not found!");
        }
        if (alreadyExists) {
            throw new BadRequestException(
                "Some users already exist in group!"
            );
        }
        const conversation = await this.findConversation(room);
        const actor = await this.getUserParticipant(conversation, ownerId);

        if (!["owner", "admin"].includes(actor.role)) {
            return this.responseJoinRoomService.createResponse(
                ownerId,
                room,
                uniqueIds,
                description,
            );
        }
        conversation.participants.push(
            ...this.groupParticipants(userIds, ownerId)
        );
        await conversation.save();
        return conversation;
    }


    private convertMapCheckElement(userIds: string[]) {
        return userIds.map(uid => ({
            $elemMatch: {userId: convertStringToObjectId(uid)},
        }));
    }

    private async checkListUser(userIds: string[]) {
        const group = await this.userService.getUserValid(userIds);
        if (group.length !== userIds.length) return false;
        return true;
    }

    private groupParticipants(
        userIds: string[],
        ownerId: string
    ): ConversationDocument["participants"] {
        return userIds.map(uid => ({
            userId: convertStringToObjectId(uid),
            role: uid === ownerId ? "owner" : "member",
        }));
    }

    public async createGroup(
        userId: string,
        name: string,
        groupIds: string[],
    ) {
        const uniqueIds = Array.from(
            new Set([userId, ...groupIds])
        );
        const ok = await this.checkListUser(uniqueIds);
        if (!ok) {
            throw new BadRequestException(
                "Some user not found.",
            );
        }
        if (uniqueIds.length < 3) {
            throw new BadRequestException(
                "Group must be at least 3 members"
            );
        }
        const existGroup = await this.conversationModel.findOne({
            name,
            type: "group",
            participants: {
                $all: this.convertMapCheckElement(uniqueIds)
            }
        });
        if (existGroup) {
            return existGroup;
        }
        return this.conversationModel.create({
            createdBy: convertStringToObjectId(userId),
            participants: this.groupParticipants(uniqueIds, userId),
            type: "group",
            name,
        });
    }

    private arrayPopulate() {
        return [
            { path: "participants.userId", select: "name avatar status" },
            {
                path: "lastMessage",
                select: "senderId content createdAt",
                populate: { path: "senderId", select: "name avatar" }
            }
        ];
    }

    public async getAllConversations(myUserId: string) {
        const conversations = await this.conversationModel
            .find({"participants.userId": convertStringToObjectId(myUserId)})
            .populate(this.arrayPopulate())
            .sort({updateAt: -1})
            .lean();

        const conversationIds = conversations.map(conv => conv._id);
        const mgsIds = await this.messageService
            .filterMessageConversationNotSeen(
                conversationIds,
                myUserId
            );

        const hashMap = new Map<string, number>();
        for (const convMgs of mgsIds) {
            const id = convMgs.toString();
            hashMap.set(id, (hashMap.get(id) || 0) + 1);
        }
        return conversations.map(conv => ({
            ...conv,
            unreadCount: hashMap.get(conv._id.toString()) || 0,
        }))
    }

    public async users(userId: string) {
        return this.userService.listUser(userId);
    }

    public async updateConversation(
        conversationId: string,
        messageId: string,
    ) {
        const updatedConversation = await this.conversationModel.findByIdAndUpdate(
            convertStringToObjectId(conversationId),
            {
                $set: {
                    lastMessage: convertStringToObjectId(messageId),
                },
            },
            { new: true }
        );
        if (!updatedConversation) {
            throw new NotFoundException("Conversation not found");
        }
        return updatedConversation;
    }

    private async findConversation(room: string) {
        const conversation = await this.conversationModel.findById(
            convertStringToObjectId(room),
        );
        if (!conversation) {
            throw new NotFoundException("Conversation not found");
        }
        return conversation;
    }

    private async getUserParticipant(
        conversation: ConversationDocument,
        userId: string
    ) {
        const obj = conversation.participants.find(
            conv => conv.userId.toString() === userId
        );
        if (!obj) {
            throw new BadRequestException(
                "Participant not found user needed!"
            );
        }
        return obj;
    }

    public async getOtherUserParticipant(
        conversationId: string,
        userId: string
    ) {
        const conversation = await this.findConversation(conversationId);
        const other = conversation.participants.find(
            p => p.userId.toString() !== userId
        );
        if (!other) {
            throw new BadRequestException(
                "Invalid private conversation"
            );
        }

        return other.userId;
    }

    public async findUserParticipants(
        userId: string,
        conversationId: string,
    ) {
        return !!(await this.conversationModel
            .findOne({
                _id: convertStringToObjectId(conversationId),
                "participants.userId": convertStringToObjectId(userId)
            }));
    }

    public async conversationsIds(conversationIds: string[]) {
        return this.conversationModel.find(
            {
                _id: {
                    $in: conversationIds.map(conv =>
                        convertStringToObjectId(conv)
                    )
                }
            },
            {
                _id: 1,
                participants: 1,
            }
        );
    }

    public async findById(conversationId: string) {
        return this.conversationModel.findById(
            convertStringToObjectId(conversationId),
            {
                _id: 1
            }
        );
    }
}