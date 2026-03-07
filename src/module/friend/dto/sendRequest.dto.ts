import {IsNotEmpty, IsMongoId, IsString, MaxLength, IsOptional} from "class-validator";

export class SendRequestDto {
    @IsNotEmpty()
    @IsMongoId()
    userId!: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    message!: string;
}