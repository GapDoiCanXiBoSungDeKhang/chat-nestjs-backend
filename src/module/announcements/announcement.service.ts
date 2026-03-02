import {Model} from "mongoose";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";

import {Announcement, AnnouncementDocument} from "./schema/announcement.schema";
import {ConversationService} from "../conversation/conversation.service";
import {UserService} from "../user/user.service";

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
}