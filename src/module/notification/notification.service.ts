import {Injectable, NotFoundException} from "@nestjs/common";
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

    async getCountUnread(userId: string) {
        return this.notificationModel
            .countDocuments({
                userId: convertStringToObjectId(userId),
                isRead: false,
            })
    }

    async findById(id: string) {
        return this.notificationModel.findById(convertStringToObjectId(id));
    }

    async markRead(id: string,  userId: string) {
        const notification = await this.findById(id);
        if (!notification) {
            throw new NotFoundException("the notification not found!");
        }
        notification.isRead = true;
        await notification.save();

        return notification;
    }
}