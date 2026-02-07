import {IsNotEmpty, IsMongoId} from "class-validator";

export class UnreactEmojiDto {
    @IsMongoId()
    @IsNotEmpty()
    id!: string;
}