import {IsMongoId} from "class-validator";

export class AddMemberDto {
    @IsMongoId({each: true})
    userIds!: string[];
}