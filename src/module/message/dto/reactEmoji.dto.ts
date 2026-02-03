import {IsString, IsNotEmpty, IsMongoId} from "class-validator";

export class ReactEmojiDto {
    @IsMongoId()
    @IsNotEmpty()
    id!: string;

    @IsString()
    @IsNotEmpty()
    emoji!: string;
}