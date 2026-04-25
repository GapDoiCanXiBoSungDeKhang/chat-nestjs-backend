import {MaxLength, MinLength} from "class-validator";

export class FindByPhoneDto {
    @MinLength(10)
    @MaxLength(10)
    q!: string;
}