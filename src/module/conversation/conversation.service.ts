import {Model, Types} from "mongoose";
import {InjectModel} from "@nestjs/mongoose";
import {ConflictException, forwardRef, Inject, Injectable} from "@nestjs/common";

import {Conversation, ConversationDocument} from "./schema/conversation.schema";

import {UserService} from "../user/user.service";
import {MessageService} from "../message/message.service";

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        private readonly userService: UserService,

        @Inject(forwardRef(() => MessageService))
        private readonly messageService: MessageService
    ) {}

    private convertIdStringToObjectId(id: string) {
        return new Types.ObjectId(id);
    }

    public async create(myUserId: Types.ObjectId, userId: string) {
        const id = this.convertIdStringToObjectId(userId);

        const findUser = await this.userService.findByObjectId(id);
        if (!findUser) {
            throw new ConflictException("User not found");
        }
        if (myUserId.equals(id)) {
            throw new ConflictException("Cannot chat with yourself");
        }
        const existConversation = await this.conversationModel.findOne({
            type: "private",
            participants: {
                $all: [
                    {$elemMatch: {userId: myUserId}},
                    {$elemMatch: {userId: id}}
                ]
            }
        });
        if (existConversation) {
            return existConversation;
        }
        const create = await this.conversationModel.create({
            type: "private",
            createdBy: myUserId,
            participants: [
                {userId: myUserId, role: "owner"},
                {userId: id, role: "member"}
            ]
        });
        return create;
    }

    public async getAllConversations(myUserId: Types.ObjectId) {
        const conversations = await this.conversationModel
            .find({"participants.userId": myUserId})
            .populate("participants.userId", "name avatar status")
            .populate({
                path: "lastMessage",
                select: "senderId content createdAt",
                populate: {
                    path: "senderId",
                    select: "name avatar"
                }
            })
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

    public async users(userId: Types.ObjectId) {
        return this.userService.listUser(userId);
    }

    public async updateConversation(
        conversationId: Types.ObjectId,
        messageId: Types.ObjectId,
    ) {
        await this.conversationModel.findByIdAndUpdate(
            conversationId,
            {lastMessage: messageId}
        )
    }

    public async findUserParticipants(
        userId: Types.ObjectId,
        conversationId: Types.ObjectId,
    ) {
        return !!(await this.conversationModel
            .findOne({
                _id: conversationId,
                "participants.userId": userId
            }));
    }
}