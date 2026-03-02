import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";
import {Announcement, announcementSchema} from "./schema/announcement.schema";

@Module({
    imports: [
        MongooseModule.forFeature([{
            name: Announcement.name,
            schema: announcementSchema,
            collection: "announcements"
        }])
    ],
    providers: [],
    exports: []
})
export class AnnouncementModule {}