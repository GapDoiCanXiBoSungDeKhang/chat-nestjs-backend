import {IsMongoId, IsNotEmpty} from "class-validator";

export class ConversationIdDto {
    @IsMongoId()
    @IsNotEmpty()
    id!: string;
}