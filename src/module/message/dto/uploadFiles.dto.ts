import {IsOptional, IsMongoId} from "class-validator";

export class UploadFilesDto {
    @IsOptional()
    @IsMongoId()
    replyTo?: string;
}