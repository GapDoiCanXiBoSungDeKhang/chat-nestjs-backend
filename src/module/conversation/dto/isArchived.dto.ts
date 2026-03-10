import {IsBoolean, IsOptional} from "class-validator";
import {Transform} from "class-transformer";

export class IsArchived {
    @Transform(({value}) => value === "true")
    @IsOptional()
    @IsBoolean()
    isArchived?: boolean;
}