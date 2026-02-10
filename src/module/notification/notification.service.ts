import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

import {Notification, NotificationDocument} from "./schema/notification.schema";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class NotificationService {
    constructor(
        @InjectModel(Notification.name)
        private readonly notificationModel: Model<NotificationDocument>
    ) {
    }

    async create(data: Partial<Notification>) {
        return this.notificationModel.create(data);
    }

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

    async markRead(id: string, userId: string) {
        return this.notificationModel.findOneAndUpdate(
            {
                _id: convertStringToObjectId(id),
                userId: convertStringToObjectId(userId)
            },
            {isRead: true},
            {new: true}
        );
    }

    async markReadAll(userId: string) {
        await this.notificationModel.updateMany(
            {
                userId: convertStringToObjectId(userId),
                isRead: false
            },
            {isRead: true}
        );
        return {
            message: "success"
        }
    }
}