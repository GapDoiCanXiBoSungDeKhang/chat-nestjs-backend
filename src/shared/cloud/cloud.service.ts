import {Injectable, InternalServerErrorException} from "@nestjs/common";
import {v2 as cloudinary} from "cloudinary";
import * as fs from "node:fs";

import {CloudUploadType, CloudUpload} from "./cloud.types";

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
        type: CloudUploadType,
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
            fs.unlink(file.path, () => {});
        }
    }

    public async uploadMultiple(
        files: Express.Multer.File[],
        type: CloudUploadType,
    ): Promise<CloudUpload[]> {
        const res: CloudUpload[] = [];
        for (const file of files) {
            const uploaded = await this.uploadSingle(file, type);
            res.push(uploaded);
        }
        return res;
    }
}