import {IsMongoId, IsString} from "class-validator";

export class AddMemberDto {
    @IsMongoId({each: true})
    userIds!: string[];

    @IsString()
    description!: string;
}