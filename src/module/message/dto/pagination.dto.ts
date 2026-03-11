import {IsMongoId, IsNumber, IsOptional, Max, Min} from "class-validator";
import {Type} from "class-transformer";

export class PaginationDto {
    @IsOptional()
    @IsMongoId()
    before!: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit: number = 20;
}
