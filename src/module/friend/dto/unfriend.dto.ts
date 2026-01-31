import {IsNotEmpty, IsMongoId} from "class-validator";

export class UnfriendDto {
    @IsNotEmpty()
    @IsMongoId()
    id!: string;
}