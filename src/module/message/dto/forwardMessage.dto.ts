import {IsNotEmpty, IsMongoId, IsArray, ArrayMinSize} from "class-validator";

export class ForwardMessageDto {
    @IsMongoId()
    @IsNotEmpty()
    id!: string;

    @IsArray()
    @IsMongoId({ each: true })
    @ArrayMinSize(1)
    conversationIds!: string[];
}