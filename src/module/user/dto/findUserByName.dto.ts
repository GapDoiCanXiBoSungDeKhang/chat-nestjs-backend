import {IsString} from "class-validator";

export class findUserByName {
    @IsString()
    name!: string;
}