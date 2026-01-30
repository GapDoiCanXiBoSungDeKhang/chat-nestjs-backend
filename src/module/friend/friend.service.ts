import {BadRequestException, ForbiddenException, Injectable, UnauthorizedException} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {FriendRequest, FriendRequestDocument} from "./schema/friendRequest.schema";

@Injectable()
export class FriendService {
    constructor(
        @InjectModel(FriendRequest.name)
        private readonly friendRequestModel: Model<FriendRequestDocument>,
    ) {}

    async friendExits(
        fromId: Types.ObjectId,
        toId: Types.ObjectId
    ) {
        return !!(await this.friendRequestModel.findOne({
            from: fromId,
            to: toId
        }))
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
            throw new BadRequestException("User already exists");
        }
        const req = await this.friendRequestModel.create({
            from: fromId,
            to: toId,
            message
        });

        return req;
    }
}