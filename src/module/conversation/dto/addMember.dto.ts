import {IsMongoId, IsOptional, IsString} from "class-validator";

export class AddMemberDto {
    @IsMongoId({each: true})
    userIds!: string[];

    @IsString()
    @IsOptional()
    description?: string;
}