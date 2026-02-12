import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";
import {LinkPreview, LinkPreviewSchema} from "./schema/link-preview.schema";
import {LinkPreviewService} from "./link-preview.service";

@Module({
    imports: [
        MongooseModule.forFeature([{
            name: LinkPreview.name,
            schema: LinkPreviewSchema,
            collection: "link-previews",
        }])
    ],
    providers: [LinkPreviewService],
    exports: [LinkPreviewService],
})
export class LinkPreviewModule {}