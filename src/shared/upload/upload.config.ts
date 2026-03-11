import {diskStorage} from "multer";
import * as fs from "node:fs";
import * as path from "node:path";

import {CloudUploadType} from "../cloud/cloud.types";
import {createFileFilter} from "./file-filter";
import {MAX_FILE_SIZE} from "./upload.constants";

export const createMulterOptions = (type: CloudUploadType) => {
    return {
        storage: diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = path.join(
                    process.cwd(),
                    "tmp",
                    type
                );
                fs.mkdirSync(uploadPath, {recursive: true});
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueName =
                    Date.now() +
                    "-" +
                    Math.round(Math.random() * 1e9) +
                    path.extname(file.originalname);
                cb(null, uniqueName);
            },
        }),
        fileFilter: createFileFilter(type),
        limits: {
            fileSize: MAX_FILE_SIZE,
        }
    }
}