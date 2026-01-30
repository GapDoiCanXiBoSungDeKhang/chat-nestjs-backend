import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {FriendRequest, FriendRequestDocument} from "./schema/friendRequest.schema";

@Injectable()
export class FriendService {
    constructor(
        @InjectModel(FriendRequest.name)
        private readonly friendRequestModel: Model<FriendRequestDocument>,
    ) {}

    async makeFriend(
        userId: Types.ObjectId,
        userIdSend: Types.ObjectId
    ) {
        const req = await this.friendRequestModel.create({
            from: userId,
            to: userIdSend,
        });
        await req.populate([
            {path: "from", select: "name avatar"},
            {path: "to", select: "name avatar"},
        ]);

        return req;
    }
}