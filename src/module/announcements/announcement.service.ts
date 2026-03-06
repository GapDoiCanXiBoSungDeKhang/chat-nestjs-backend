import {Model} from "mongoose";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";

import {Announcement, AnnouncementDocument} from "./schema/announcement.schema";

import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class AnnouncementService {
    constructor(
        @InjectModel(Announcement.name)
        private readonly announcementModel: Model<AnnouncementDocument>,
    ) {
    }

    public async createAnnouncement(
        conversationId: string,
        pinnedBy: string,
        content: string,
    ) {
        const convObjectId = convertStringToObjectId(conversationId)
        const userObjectId = convertStringToObjectId(pinnedBy);

        return this.announcementModel.create({
            conversationId: convObjectId,
            pinnedBy: userObjectId,
            status: "active",
            content
        });
    }

    public async announcements(conversationId: string) {
        return this.announcementModel.find({
            conversationId: convertStringToObjectId(conversationId)
        })
            .populate("pinnedBy", "name status avatar")
            .sort({createdAt: -1})
            .lean();
    }
}