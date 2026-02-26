import {Model} from "mongoose";
import {InjectModel} from "@nestjs/mongoose";
import {
    ForbiddenException,
    forwardRef,
    Inject,
    Injectable,
    NotFoundException
} from "@nestjs/common";

import {Conversation, ConversationDocument} from "./schema/conversation.schema";

import {UserService} from "../user/user.service";
import {MessageService} from "../message/message.service";
import {AttachmentService} from "../attachment/attachment.service";
import {AttachmentDocument} from "../attachment/schema/attachment.schema";
import {LinkPreviewService} from "../link-preview/link-preview.service";
import {LinkPreviewDocument} from "../link-preview/schema/link-preview.schema";
import {RequestJoinRoomService} from "../requestJoinRoom/requestJoinRoom.service";
import {FriendService} from "../friend/friend.service";

import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";
import {ChatGateway} from "../../gateway/chat.gateway";

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        private readonly chatGateway: ChatGateway,
        private readonly userService: UserService,
        @Inject(forwardRef(() => MessageService))
        private readonly messageService: MessageService,
        // private readonly friendService: FriendService,
        private readonly attachmentService: AttachmentService,
        private readonly linkPreviewService: LinkPreviewService,
        private readonly requestJoinRoomService: RequestJoinRoomService
    ) {
    }

    public async create(myUserId: string, userId: string) {
        const uniqueIds = Array.from(
            new Set([userId, myUserId])
        )
        const ok = await this.checkListUser(uniqueIds);
        if (!ok) {
            throw new ForbiddenException(
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
            "participants.userId": {$in: mbObjectIds}
        });

        return !!existingConversation;
    }

    public async addMembers(
        room: string,
        actorId: string,
        userIds: string[],
        description: string,
    ) {
        const uniqueIds = Array.from(new Set(userIds));

        const [validUsers, alreadyExists] = await Promise.all([
            this.checkListUser(uniqueIds),
            this.isAnyMemberExists(room, uniqueIds)
        ]);
        if (!validUsers) {
            throw new ForbiddenException("Some users not found!");
        }
        if (!uniqueIds.length) {
            throw new ForbiddenException("User must be less than 1");
        }
        if (alreadyExists) {
            throw new ForbiddenException(
                "Some users already exist in group!"
            );
        }
        const conversation = await this.findConversation(room);
        const actor = this.getUserParticipant(conversation, actorId);

        if (!["owner", "admin"].includes(actor.role)) {
            const newRequest = await this.requestJoinRoomService.createResponse(
                actorId,
                room,
                uniqueIds,
                description,
            );

            this.chatGateway.emitNewRequestJoinRoom(room, newRequest);
            return newRequest;
        }

        const newMembers = this.groupParticipants(userIds, actorId);
        conversation.participants.push(...newMembers);

        await conversation.save();
        const [addedUsers, addedBy] = await Promise.all([
            this.userService.getInfoUserIds(uniqueIds),
            this.userService.getInfoById(actorId)
        ]);

        this.chatGateway.emitAddMembersGroup(room, {
            conversationId: room,
            addedUsers,
            addedBy,
            conversation,
        });

        return conversation;
    }

    public async removeMembers(
        room: string,
        actorId: string,
        userIds: string[],
    ) {
        const ok = await this.checkListUser(userIds);
        if (!ok) {
            throw new ForbiddenException("Some users not found!");
        }
        if (!userIds.length) {
            throw new ForbiddenException("User must be less than 1!");
        }
        const conversation = await this.findConversation(room);
        const actor = this.getUserParticipant(conversation, actorId);
        const checkCanRemoveMem = this.checkCantRemoveMember(
            conversation,
            userIds,
            actorId
        );

        if (!["owner", "admin"].includes(actor.role)) {
            throw new ForbiddenException(
                "User role must be a owner or admin!"
            );
        }
        if (!checkCanRemoveMem) {
            throw new ForbiddenException(
                "Can't remove member for this conversation!"
            );
        }
        const uniqueIds = new Set(userIds);
        const newParticipants = conversation.participants
            .filter(obj => !uniqueIds.has(obj.userId.toString()));

        conversation.participants = newParticipants;
        await conversation.save();
        this.chatGateway.emitRemoveMembersGroup(room, {
            conversationId: room,
            removedUserIds: userIds,
            removedBy: actorId,
            ...conversation
        });

        return conversation;
    }

    public async changeRole(
        actorId: string,
        room: string,
        userId: string,
        role: "admin" | "member",
    ) {
        const ok = await this.checkListUser([userId]);
        if (!ok) {
            throw new ForbiddenException("User not found!");
        }
        const conversation = await this.findConversation(room);
        const actor = this.getUserParticipant(conversation, actorId);
        const obj = this.getUserParticipant(
            conversation,
            userId
        );

        if (!["owner", "admin"].includes(actor.role)) {
            throw new ForbiddenException("User role must be a owner or admin!")
        }
        if (actorId === userId) {
            throw new ForbiddenException(
                "You can't change role for this you!"
            )
        }
        if (actor.role === "admin" && obj.role === "owner") {
            throw new ForbiddenException(
                "You can't change role for this user!"
            );
        }
        const participant = this.getUserParticipant(conversation, userId);
        participant.role = role;
        await conversation.save();
        this.chatGateway.emitChangeRoleMemberGroup(room, conversation);

        return conversation;
    }

    public async leaveGroup(userId: string, room: string) {
        const conversation = await this.findConversation(room);
        const actor = this.getUserParticipant(conversation, userId);

        if (actor.role === "owner") {
            let newOwner = conversation.participants.find(
                p => p.userId.toString() !== userId && p.role === "admin"
            );
            if (!newOwner) {
                newOwner = conversation.participants.find(
                    p => p.userId.toString() !== userId
                );
            }
            if (newOwner) {
                newOwner.role = "owner";
            } else {
                await conversation.deleteOne();
                this.chatGateway.emitLeftGroup(room, {
                    conversationId: room,
                    userId: userId,
                    conversation: null,
                    deleted: true
                });
                return {
                    status: "group is deleted!"
                }
            }
        }
        const newParticipants = conversation.participants.filter(
            obj => obj.userId.toString() !== userId
        );
        conversation.participants = newParticipants;
        await conversation.save();
        this.chatGateway.emitLeftGroup(room, conversation);

        return conversation;
    }

    public async listRequestJoinRoom(
        room: string,
        actorId: string
    ) {
        const conversation = await this.findConversation(room);
        const actor = this.getUserParticipant(conversation, actorId);

        if (!["owner", "admin"].includes(actor.role)) {
            throw new ForbiddenException("User role must be a owner or admin!")
        }
        return this.requestJoinRoomService.listRequestJoinRoom(
            conversation._id.toString()
        );
    }

    public async handleRequest(
        room: string,
        action: "accept" | "reject",
        id: string,
        actorId: string
    ) {
        const conversation = await this.findConversation(room);
        const actor = this.getUserParticipant(conversation, actorId);

        if (!["owner", "admin"].includes(actor.role)) {
            throw new ForbiddenException("User role must be a owner or admin!");
        }
        const userId = await this.requestJoinRoomService
            .handleRequestJoinRoom(id);

        if (action === "accept") {
            const participant = this.groupParticipants([userId], actorId);
            conversation.participants.push(
                ...participant
            );
            await conversation.save();
            return conversation;
        }

        this.chatGateway.emitHandelRequestJoinRoom(room, {
            conversationId: room,
            requestId: id,
            action,
            userId
        });
        return {
            status: "reject",
            message: "request have been rejected!"
        }
    }

    private checkCantRemoveMember(
        conversation: ConversationDocument,
        members: string[],
        actorId: string
    ) {
        const uids = new Set(
            conversation.participants
                .map(uid => uid.userId.toString())
        );
        for (const uid of members) {
            if (!uids.has(uid)) {
                return false;
            }
            if (uid === actorId) {
                return false;
            }
            const obj = this.getUserParticipant(conversation, uid)
            if (obj.role === "owner") {
                return false;
            }
        }
        return true;
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
        const uniqueIds = Array.from(new Set([userId, ...groupIds]));

        const ok = await this.checkListUser(uniqueIds);
        if (!ok) {
            throw new ForbiddenException(
                "Some user not found.",
            );
        }
        if (uniqueIds.length < 3) {
            throw new ForbiddenException(
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
        const group = await this.conversationModel.create({
            createdBy: convertStringToObjectId(userId),
            participants: this.groupParticipants(uniqueIds, userId),
            type: "group",
            name,
        });
        await group.populate("createdBy", "name");

        this.chatGateway.emitGroupCreated(uniqueIds, {
            conversation: group,
            createdBy: {
                _id: group.createdBy._id.toString(),
                name: group.createdBy.name,
            }
        });

        return group;
    }

    private arrayPopulate() {
        return [
            {path: "participants.userId", select: "name avatar status"},
            {
                path: "lastMessage",
                select: "senderId content createdAt",
                populate: {path: "senderId", select: "name avatar"}
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
        // const listIds = await this.friendService.friends(userId);
        // return this.userService.listUser(
        //     listIds.map(uid => uid._id.toString())
        // );
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
            {new: true}
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

    private getUserParticipant(
        conversation: ConversationDocument,
        userId: string
    ) {
        const obj = conversation.participants.find(
            conv => conv.userId.toString() === userId
        );
        if (!obj) {
            throw new ForbiddenException(
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
            throw new ForbiddenException(
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