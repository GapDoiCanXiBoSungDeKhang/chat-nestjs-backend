import {IsMongoId, IsNumber, IsOptional} from "class-validator";
import {Type} from "class-transformer";

export class PaginationDto {
    @IsOptional()
    @IsMongoId()
    before!: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit: number = 19;
}
