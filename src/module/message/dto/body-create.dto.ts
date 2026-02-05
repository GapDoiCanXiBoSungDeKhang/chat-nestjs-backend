import {IsString, IsNotEmpty, IsOptional, IsMongoId} from "class-validator";

export class CreateMessageDto {
    @IsString()
    @IsNotEmpty()
    content!: string;

    @IsOptional()
    @IsMongoId()
    replyTo?: string;
}