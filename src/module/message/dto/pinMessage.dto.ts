import {IsMongoId} from "class-validator";

export class PinMessageDto {
    @IsMongoId()
    id!: string;
}