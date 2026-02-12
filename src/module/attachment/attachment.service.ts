import {Model} from "mongoose";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";

import {Attachment, AttachmentDocument} from "./schema/attachment.schema";
import {CloudService} from "../../shared/cloud/cloud.service";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class AttachmentService {
    constructor(
        @InjectModel(Attachment.name)
        private readonly attachmentModel: Model<AttachmentDocument>,
        private readonly cloudService: CloudService,
    ) {
    }

    public async uploadFiles(
        files: Express.Multer.File[],
        messageId: string,
        uploaderId: string,
        conversationId: string,
    ) {
        const res = await this.cloudService.uploadMultiple(
            files,
            messageId,
            conversationId,
            uploaderId
        );

        return this.attachmentModel.insertMany(res);
    }

    public async uploadMedias(
        files: Express.Multer.File[],
        messageId: string,
        uploaderId: string,
        conversationId: string,
    ) {
        return this.uploadFiles(
            files,
            messageId,
            uploaderId,
            conversationId,
        );
    }

    public async uploadVoice(
        file: Express.Multer.File,
        messageId: string,
        uploaderId: string,
        conversationId: string,
    ) {
        const uploaderObjectId = convertStringToObjectId(uploaderId);
        const messageObjectId = convertStringToObjectId(messageId);
        const conversationObjectId = convertStringToObjectId(conversationId);

        const upload = await this.cloudService.uploadSingle(file, "voice");
        return this.attachmentModel.create({
            messageId: messageObjectId,
            conversationId: conversationObjectId,
            uploaderId: uploaderObjectId,
            type: "voice",
            url: upload.url,
            thumbnail: upload.thumbnail,
            filename: file.filename,
            originalName: file.originalname,
            size: upload.size,
            mimeType: upload.mimeType,
            duration: upload.duration,
        });
    }
}
