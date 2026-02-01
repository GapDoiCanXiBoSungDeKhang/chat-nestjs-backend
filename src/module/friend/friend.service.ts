import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    UnauthorizedException
} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

import {FriendRequest, FriendRequestDocument} from "./schema/friendRequest.schema";
import {ConversationService} from "../conversation/conversation.service";
import {NotificationService} from "../notification/notification.service";

import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class FriendService {
    constructor(
        @InjectModel(FriendRequest.name)
        private readonly friendRequestModel: Model<FriendRequestDocument>,
        private readonly conversationService: ConversationService,
        private readonly notificationService: NotificationService,
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

        const request = await this.friendRequestModel.create({
            from: convertStringToObjectId(fromId),
            to: convertStringToObjectId(toId),
            message
        });
        await this.notificationService.create({
            userId: convertStringToObjectId(toId),
            type: "friend_request",
            refId: request._id,
            payload: {
                fromId: convertStringToObjectId(fromId),
            }
        });

        return request;
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

        await this.notificationService.create({
            userId: req.from,
            type: "friend_accepted",
            refId: req._id,
            payload: {
                fromId: req.to,
            }
        })
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

    async request(userId: string) {
        return this.friendRequestModel
            .find({
                to: convertStringToObjectId(userId),
                status: "pending"
            })
                .populate("from", "name avatar")
                .sort({ createdAt: -1 })
                .lean();
    }

    async friends(userId: string) {
        const friends = await this.friendRequestModel
            .find({
                status: "accepted",
                $or: [
                    {from: convertStringToObjectId(userId)},
                    {to: convertStringToObjectId(userId)}
                ]
            })
                .populate("from to", "name avatar status")

        return friends.map(
            r => r.from._id.toString() === userId
                ? r.to
                : r.from
        );
    }

    async unfriend(userId: string, targetUserId: string) {
        const relation = await this.friendRequestModel
            .findOne({
                status: "accepted",
                $or: [
                    {
                        from: convertStringToObjectId(userId),
                        to: convertStringToObjectId(targetUserId)
                    },
                    {
                        from: convertStringToObjectId(targetUserId),
                        to: convertStringToObjectId(userId)
                    }
                ]
            });

        if (!relation) {
            throw new NotFoundException("Not friend");
        }
        await relation.deleteOne();
        return {
            success: true
        }
    }
}