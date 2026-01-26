import {IsEmail, IsNotEmpty, MaxLength, MinLength} from "class-validator";

export class InputRegisterUserDto {
    @IsEmail()
    email!: string;

    @IsNotEmpty()
    @MinLength(8)
    password!: string;

    @IsNotEmpty()
    @MinLength(8)
    passwordConfirm!: string;

    @IsNotEmpty()
    firstName!: string;

    @IsNotEmpty()
    lastName!: string;

    @IsNotEmpty()
    @MinLength(10)
    @MaxLength(11)
    phoneNumber!: string;
}