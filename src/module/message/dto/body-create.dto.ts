import {IsString, IsMongoId, IsNotEmpty} from "class-validator";

export class CreateMessageDto {
    @IsString()
    @IsNotEmpty()
    content!: string;
}