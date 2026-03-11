import {IsOptional, IsMongoId, IsString} from "class-validator";

export class LinkPreviewDto {
    @IsString()
    content!: string;

    @IsOptional()
    @IsMongoId()
    replyTo?: string;
}