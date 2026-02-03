import {IsString, IsNotEmpty, IsMongoId} from "class-validator";

export class EditMessageDto {
    @IsString()
    @IsNotEmpty()
    content!: string;

    @IsMongoId()
    @IsNotEmpty()
    id!: string
}