import {IsUrl, IsOptional, IsMongoId, IsString} from "class-validator";

export class LinkPreviewDto {
    @IsUrl()
    content!: string;

    @IsOptional()
    @IsMongoId()
    replyTo?: string;
}