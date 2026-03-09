import {IsMongoId} from "class-validator";

export class BlockedUser {
    @IsMongoId()
    userId!: string;
}