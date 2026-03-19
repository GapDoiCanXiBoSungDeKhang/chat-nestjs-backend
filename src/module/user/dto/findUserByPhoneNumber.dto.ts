import {IsString} from "class-validator";

export class findUserByPhoneNumberDto {
    @IsString()
    phone!: string;
}