import {BadRequestException, ForbiddenException, Injectable, UnauthorizedException} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {FriendRequest, FriendRequestDocument} from "./schema/friendRequest.schema";
import {ConversationService} from "../conversation/conversation.service";

@Injectable()
export class FriendService {
    constructor(
        @InjectModel(FriendRequest.name)
        private readonly friendRequestModel: Model<FriendRequestDocument>,
        private readonly conversationService: ConversationService,
    ) {}

    async friendExits(
        fromId: Types.ObjectId,
        toId: Types.ObjectId
    ) {
        return this.friendRequestModel.findOne({
            $or: [
                {from: fromId, to: toId},
                {from: toId, to: fromId},
            ],
        });
    }

    async makeFriend(
        fromId: Types.ObjectId,
        toId: Types.ObjectId,
        message: string,
    ) {
        if (fromId === toId) {
            throw new ForbiddenException("User not is a user");
        }
        const exits = await this.friendExits(fromId, toId);
        if (exits) {
            if (exits.status === "accepted")
                throw new BadRequestException("Already friend");
            if (exits.status === "pending")
                throw new BadRequestException("Request already pending");
        }

        return this.friendRequestModel.create({
            from: fromId,
            to: toId,
            message
        });
    }

    async findRequestId(id: Types.ObjectId) {
        return this.friendRequestModel.findById(id);
    }

    async acceptedRequest(
        requestId: Types.ObjectId,
        userId: Types.ObjectId
    ) {
        const req = await this.findRequestId(requestId);
        if (!req || req.to === userId) {
            throw new ForbiddenException("User get request not for you!");
        }
        if (req.status !== "pending") {
            throw new BadRequestException("Request already handled");
        }
        req.status = "accepted";
        await req.save();
        const conversation = await this.conversationService
            .create(
                req.from,
                req.to.toString()
            );

        return {
            req,
            conversation
        };
    }
}