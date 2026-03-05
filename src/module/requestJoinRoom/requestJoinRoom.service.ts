import {Model} from "mongoose";
import {ForbiddenException, Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";

import {RequestJoinRoom, RequestJoinRoomDocument} from "./schema/requestJoinRoom.schema";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class RequestJoinRoomService {
    constructor(
        @InjectModel(RequestJoinRoom.name)
        private readonly requestJoinRoomModel: Model<RequestJoinRoomDocument>,
    ) {
    }

    public async createResponse(
        ownerId: string,
        conversationId: string,
        userIds: string[],
        description: string
    ) {
        const data = userIds.map(uid => ({
            userId: convertStringToObjectId(uid),
            actor: convertStringToObjectId(ownerId),
            conversationId: convertStringToObjectId(conversationId),
            description
        }));
        return this.requestJoinRoomModel.insertMany(data);
    }

    public async listRequestJoinRoom(room: string) {
        return this.requestJoinRoomModel.find({
            conversationId: convertStringToObjectId(room),
            status: "pending"
        })
            .populate([
                {path: "userId", select: "name avatar status"},
                {path: "actor", select: "name avatar status"},
            ])
            .sort({createdAt: -1})
            .lean();
    }

    public async handleRequestJoinRoom(id: string, action: "accept" | "reject") {
        const request = await this.requestJoinRoomModel
            .findById(convertStringToObjectId(id));

        if (!request) {
            throw new ForbiddenException("not found request!");
        }
        const userId = request.userId.toString();
        request.status = action;

        return userId;
    }
}