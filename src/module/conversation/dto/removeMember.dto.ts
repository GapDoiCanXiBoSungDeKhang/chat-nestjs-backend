import {IsMongoId} from "class-validator";

export class RemoveMemberDto {
    @IsMongoId({each: true})
    userIds!: string[];
}