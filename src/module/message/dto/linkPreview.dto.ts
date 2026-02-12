import {IsOptional, IsMongoId, IsString} from "class-validator";

export class LinkPreviewDto {
    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsMongoId()
    replyTo?: string;
}