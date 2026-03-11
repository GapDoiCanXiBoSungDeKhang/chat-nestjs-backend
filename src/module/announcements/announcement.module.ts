import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";
import {Announcement, announcementSchema} from "./schema/announcement.schema";

import {AnnouncementService} from "./announcement.service";

@Module({
    imports: [
        MongooseModule.forFeature([{
            name: Announcement.name,
            schema: announcementSchema,
            collection: "announcements"
        }])
    ],
    providers: [AnnouncementService],
    exports: [AnnouncementService]
})
export class AnnouncementModule {}