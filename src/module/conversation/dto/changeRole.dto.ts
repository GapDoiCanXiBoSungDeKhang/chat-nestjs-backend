import {IsEnum, IsMongoId} from "class-validator";

export enum RoleType {
    admin = "admin",
    member = "member",
}

export class ChangeRoleDto {
    @IsMongoId()
    id!: string;

    @IsEnum(RoleType)
    role!: RoleType;
}