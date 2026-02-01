import {IsString, IsMongoId, IsNotEmpty} from "class-validator";

export class MarkReadDto {
    @IsString()
    @IsNotEmpty()
    @IsMongoId()
    id!: string;
}