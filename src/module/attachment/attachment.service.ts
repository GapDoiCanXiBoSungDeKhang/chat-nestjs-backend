import {Model} from "mongoose";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";

import {Attachment, AttachmentDocument} from "./schema/attachment.schema";
import {CloudService} from "../../shared/cloud/cloud.service";

@Injectable()
export class AttachmentService {
    constructor(
        @InjectModel(Attachment.name)
        private readonly attachmentModel: Model<AttachmentDocument>,
        private readonly cloudService: CloudService,
    ) {}

    public async uploadFiles(
        files: Express.Multer.File[],
        messageId: string,
        uploaderId: string,
        conversationId: string,
    ) {
        const res = await this.cloudService.uploadMultiple(
            files,
            "file",
            messageId,
            conversationId,
            uploaderId
        );

        return this.attachmentModel.insertMany(res);
    }
}
