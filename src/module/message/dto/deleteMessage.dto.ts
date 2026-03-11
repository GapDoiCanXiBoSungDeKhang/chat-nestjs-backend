import {IsNotEmpty, IsMongoId} from "class-validator";

export class DeleteMessageDto {
    @IsMongoId()
    @IsNotEmpty()
    id!: string;
}