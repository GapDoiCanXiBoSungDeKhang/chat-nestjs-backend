import {IsNotEmpty, IsMongoId, IsString, MaxLength} from "class-validator";

export class SendRequestDto {
    @IsNotEmpty()
    @IsMongoId()
    userId!: string;

    @IsString()
    @MaxLength(300)
    message!: string;
}