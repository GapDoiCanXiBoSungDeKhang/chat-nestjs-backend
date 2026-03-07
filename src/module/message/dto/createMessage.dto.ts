import {IsString, IsNotEmpty, IsOptional, IsMongoId, MaxLength} from "class-validator";

export class CreateMessageDto {
    @IsString()
    @MaxLength(5000)
    @IsNotEmpty()
    content!: string;

    @IsOptional()
    @IsMongoId()
    replyTo?: string;

    @IsOptional()
    @IsMongoId({each: true})
    mentions?: string[];
}