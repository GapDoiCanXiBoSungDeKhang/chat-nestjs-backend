import {BadRequestException, ForbiddenException, Injectable, UnauthorizedException} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

import {FriendRequest, FriendRequestDocument} from "./schema/friendRequest.schema";
import {ConversationService} from "../conversation/conversation.service";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class FriendService {
    constructor(
        @InjectModel(FriendRequest.name)
        private readonly friendRequestModel: Model<FriendRequestDocument>,
        private readonly conversationService: ConversationService,
    ) {}

    async friendExits(
        fromId: string,
        toId: string
    ) {
        return this.friendRequestModel.findOne({
            $or: [
                {
                    from: convertStringToObjectId(fromId),
                    to: convertStringToObjectId(toId)
                },
                {
                    from: convertStringToObjectId(toId),
                    to: convertStringToObjectId(fromId)
                },
            ],
        });
    }

    async makeFriend(
        fromId: string,
        toId: string,
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
            from: convertStringToObjectId(fromId),
            to: convertStringToObjectId(toId),
            message
        });
    }

    async findRequestId(id: string) {
        return this.friendRequestModel.findById(convertStringToObjectId(id));
    }

    async acceptedRequest(
        requestId: string,
        userId: string
    ) {
        const req = await this.findRequestId(requestId);

        if (!req || req.to.toString() !== userId) {
            throw new ForbiddenException("User get request not for you!");
        }
        if (req.status !== "pending") {
            throw new BadRequestException("Request already handled");
        }
        req.status = "accepted";
        await req.save();

        const conversation = await this.conversationService
            .create(
                req.from.toString(),
                req.to.toString()
            );

        return {
            req,
            conversation
        };
    }

    async rejectedRequest(
        requestId: string,
        userId: string
    ) {
        const req = await this.findRequestId(requestId);

        if (!req || req.to.toString() !== userId) {
            throw new ForbiddenException("User get request not for you!");
        }
        if (req.status !== "pending") {
            throw new BadRequestException("Request already handled");
        }
        req.status = "rejected";
        await req.save();

        return req;
    }
}