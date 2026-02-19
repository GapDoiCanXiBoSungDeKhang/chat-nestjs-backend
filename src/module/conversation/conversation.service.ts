import {Model} from "mongoose";
import {InjectModel} from "@nestjs/mongoose";
import {
    BadRequestException,
    ConflictException, ForbiddenException,
    forwardRef,
    Inject,
    Injectable,
    NotFoundException
} from "@nestjs/common";

import {Conversation, ConversationDocument} from "./schema/conversation.schema";

import {UserService} from "../user/user.service";
import {MessageService} from "../message/message.service";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        private readonly userService: UserService,
        @Inject(forwardRef(() => MessageService))
        private readonly messageService: MessageService
    ) {
    }

    public async create(myUserId: string, userId: string) {
        const findUser = await this.userService.findByObjectId(userId);

        if (!findUser) {
            throw new ConflictException("User not found");
        }
        if (myUserId === userId) {
            throw new ConflictException("Cannot gateway with yourself");
        }
        const existConversation = await this.conversationModel.findOne({
            type: "private",
            participants: {
                $all: [
                    {$elemMatch: {userId: convertStringToObjectId(myUserId)}},
                    {$elemMatch: {userId: convertStringToObjectId(userId)}}
                ]
            }
        });
        if (existConversation) {
            return existConversation;
        }
        const create = await this.conversationModel.create({
            type: "private",
            createdBy: convertStringToObjectId(myUserId),
            participants: [
                {userId: convertStringToObjectId(myUserId), role: "owner"},
                {userId: convertStringToObjectId(userId), role: "member"}
            ]
        });
        return create;
    }

    public async infoPrivate(id: string) {
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

    private convertMapCheckElement(userIds: string[]) {
        return userIds.map(uid => ({
            $elemMatch: {userId: convertStringToObjectId(uid)},
        }));
    }

    private async checkListUser(userIds: string[]) {
        const idsObjectId = userIds.map(uid => convertStringToObjectId(uid));

        const group = await this.conversationModel.find({
            "participants.userId": {$in: idsObjectId},
        });
        if (group.length !== userIds.length) return false;
        return true;
    }

    private groupParticipants(userIds: string[], ownerId: string) {
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


    public async getUserParticipant(
        conversationId: string,
        userId: string
    ) {
        const conversation = await this.conversationModel.findOne(
            {
                _id: convertStringToObjectId(conversationId),
                "participants.userId": convertStringToObjectId(userId)
            },
            {
                participants: 1,
            }
        );

        if (!conversation) {
            throw new NotFoundException("Conversation not found");
        }
        const other = conversation.participants.find(
            p => p.userId.toString() !== userId
        );
        if (!other) {
            throw new BadRequestException("Invalid private conversation");
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