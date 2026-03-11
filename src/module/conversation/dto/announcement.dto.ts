import {IsString} from "class-validator";

export class AnnouncementDto {
    @IsString()
    content!: string;
}