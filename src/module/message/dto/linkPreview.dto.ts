import {IsUrl, IsOptional, IsMongoId} from "class-validator";

export class LinkPreviewDto {
    @IsUrl()
    url!: string;

    @IsOptional()
    @IsMongoId()
    replyTo?: string;
}