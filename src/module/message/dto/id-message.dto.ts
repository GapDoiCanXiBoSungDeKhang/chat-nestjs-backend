import {IsMongoId, IsNotEmpty} from "class-validator";

export class IdMessageDto {
    @IsMongoId()
    @IsNotEmpty()
    "id-message"!: string;
}