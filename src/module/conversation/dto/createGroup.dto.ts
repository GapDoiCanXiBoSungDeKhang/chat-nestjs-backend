import {ArrayMinSize, IsMongoId, IsNotEmpty, IsString, MaxLength} from "class-validator";

export class CreateGroupDto {
    @IsMongoId({each: true})
    @ArrayMinSize(2)
    groupIds!: string[];

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name!: string;
}