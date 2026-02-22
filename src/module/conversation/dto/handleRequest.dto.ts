import {IsEnum, IsMongoId} from "class-validator";

enum ActionType {
    accept = "accept",
    reject = "reject",
}

export class HandleRequestDto {
    @IsEnum(ActionType)
    action!: ActionType;

    @IsMongoId()
    id!: string;
}