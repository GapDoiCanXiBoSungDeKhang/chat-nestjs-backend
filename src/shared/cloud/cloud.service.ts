import {Injectable, InternalServerErrorException} from "@nestjs/common";
import {v2 as cloudinary} from "cloudinary";
import * as fs from "node:fs";

import {CloudUpload, UploadFileType} from "./cloud.types";
import {convertStringToObjectId} from "../helpers/convertObjectId.helpers";

@Injectable()
export class CloudService {
    constructor() {
        cloudinary.config({
            cloud_name: process.env.CLOUD_NAME,
            api_key: process.env.CLOUD_API_KEY,
            api_secret: process.env.CLOUD_API_SECRET,
        });
    }

    public async uploadSingle(
        file: Express.Multer.File,
        type: UploadFileType,
    ): Promise<CloudUpload> {
        try {
            const resourceType = type === "image"
                ? "image"
                : type === "video" || type === "voice"
                    ? "video"
                    : "raw"
            const res = await cloudinary.uploader.upload(
                file.path,
                {
                    resource_type: resourceType,
                    folder: `chat/${type}`,
                    use_filename: true,
                    unique_filename: true,
                }
            );

            return {
                url: res.secure_url,
                size: res.bytes,
                publicId: res.public_id,
                thumbnail: res.resource_type === "image"
                    ? res.secure_url.replace(
                        "upload",
                        "upload/w_300"
                    )
                    : undefined,
                mimeType: res.mimetype,
                originalName: res.original_filename,
                duration: res.duration,
            }
        } catch (err) {
            throw new InternalServerErrorException("Upload to Cloudinary failed");
        } finally {
            fs.unlink(file.path, () => {
            });
        }
    }

    public async uploadMultiple(
        files: Express.Multer.File[],
        messageId: string,
        conversationId: string,
        uploaderId: string,
    ) {
        const messageObjectId = convertStringToObjectId(messageId);
        const conversationObjectId = convertStringToObjectId(conversationId);
        const uploaderObjectId = convertStringToObjectId(uploaderId);

        const uploads = await Promise.all(
            files.map(file => {
                const type = this.detectType(file.mimetype);
                return this.uploadSingle(file, type);
            })
        );
        return uploads.map((upload, i) => {
            const detected = this.detectType(files[i].mimetype);
            return {
                messageId: messageObjectId,
                conversationId: conversationObjectId,
                uploaderId: uploaderObjectId,
                type: detected,
                url: upload.url,
                thumbnail: upload.thumbnail,
                filename: files[i].filename,
                originalName: files[i].originalname,
                size: upload.size,
                mimeType: upload.mimeType,
                duration: upload.duration,
            }
        });
    }

    private detectType(mime: string) {
        if (mime.startsWith("image/")) return "image";
        if (mime.startsWith("video/")) return "video";
        return "file";
    }
}