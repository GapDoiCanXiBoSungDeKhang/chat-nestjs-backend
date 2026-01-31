import {IsNotEmpty, IsMongoId, IsString} from "class-validator";

export class ResRequestDto {
    @IsNotEmpty()
    @IsMongoId()
    id!: string;

    @IsNotEmpty()
    @IsString()
    action!: string;
}