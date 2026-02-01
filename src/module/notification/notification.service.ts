import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

import {NotificationDocument} from "./schema/notification.schema";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class NotificationService {
    constructor(
        @InjectModel("Notification")
        private readonly notificationModel: Model<NotificationDocument>
    ) {}

    async getAll(userId: string) {
        return this.notificationModel
            .find({
                userId: convertStringToObjectId(userId)
            })
            .populate("userId", "name avatar")
            .sort({createdAt: -1})
            .limit(50)
            .lean();
    }
}