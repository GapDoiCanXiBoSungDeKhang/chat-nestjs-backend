import {Model} from "mongoose";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";

import {ResponseJoinRoom, ResponseJoinRoomDocument} from "./schema/requestJoinRoom.schema";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class RequestJoinRoomService {
    constructor(
        @InjectModel(ResponseJoinRoom.name)
        private readonly responseJoinRoomModel: Model<ResponseJoinRoomDocument>,
    ) {
    }

    public async createResponse(
        ownerId: string,
        conversationId: string,
        userIds: string[],
        description: string
    ) {
        const response = userIds.map(uid => ({
            userId: convertStringToObjectId(uid),
            actor: convertStringToObjectId(ownerId),
            conversationId: convertStringToObjectId(conversationId),
            description
        }));
        return this.responseJoinRoomModel.insertMany(response);
    }
}