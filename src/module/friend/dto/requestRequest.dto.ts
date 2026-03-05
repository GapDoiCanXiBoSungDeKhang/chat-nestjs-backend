import {IsNotEmpty, IsMongoId, IsString, IsEnum} from "class-validator";

enum action {
    "accepted" = "accepted",
    "rejected" = "rejected",
    "pending" = "pending",
}

export class ResRequestIdDto {
    @IsNotEmpty()
    @IsMongoId()
    id!: string;
}

export class ResResponseActionDto {
    @IsNotEmpty()
    @IsString()
    @IsEnum(action)
    readonly action!: action;
}