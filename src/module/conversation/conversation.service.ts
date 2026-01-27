import {Model, Types} from "mongoose";
import {InjectModel} from "@nestjs/mongoose";
import {ConflictException, Injectable} from "@nestjs/common";

import {Conversation, ConversationDocument} from "./schema/conversation.schema";
import {UserService} from "../user/user.service";

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        private readonly userService: UserService,
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
                {userId: myUserId},
                {userId: id}
            ]
        });
        return create;
    }

    async getAllConversations(myUserId: Types.ObjectId) {
        return this.conversationModel
            .find({"participants.userId": myUserId})
            .populate("participants.userId", "name avatar status")
            .sort({createdAt: -1})
            .lean();
    }
}