import {IsMongoId, IsNotEmpty} from "class-validator";

export class IdConversationDto {
    @IsMongoId()
    @IsNotEmpty()
    id!: string;
}