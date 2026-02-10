import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {Attachment, AttachmentSchema} from "./schema/attachment.schema";
import {CloudModule} from "../../shared/cloud/cloud.module";
import {AttachmentService} from "./attachment.service";

@Module({
    imports: [
        CloudModule,
        MongooseModule.forFeature([{
            name: Attachment.name,
            schema: AttachmentSchema,
            collection: "attachments",
        }])
    ],
    providers: [AttachmentService],
    exports: [AttachmentService],
})
export class AttachmentModule {}