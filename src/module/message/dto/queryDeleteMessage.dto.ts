import {IsEnum, IsNotEmpty} from "class-validator";

export enum ScopeTypeDelete {
    self = "self",
    everyone = "everyone",
}

export class QueryDeleteMessageDto {
    @IsNotEmpty()
    @IsEnum(ScopeTypeDelete)
    scope!: ScopeTypeDelete;
}