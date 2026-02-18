import {IsMongoId, IsString} from "class-validator";

export class CreateGroupDto {
    @IsMongoId({each: true})
    groupIds!: string[];

    @IsString()
    name!: string;
}