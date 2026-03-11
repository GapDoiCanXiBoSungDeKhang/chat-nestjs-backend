import {IsEmail, IsNotEmpty, MinLength} from "class-validator";

export class registerDto {
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @IsNotEmpty()
    @MinLength(8)
    password!: string;

    @IsNotEmpty()
    name!: string;

    @IsNotEmpty()
    @MinLength(10)
    phoneNumber!: string;
}