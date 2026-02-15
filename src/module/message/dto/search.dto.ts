import {IsString} from "class-validator";

export class SearchMessageDto {
    @IsString()
    q!: string;
}
