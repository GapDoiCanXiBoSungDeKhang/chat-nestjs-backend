import {IsEnum, IsMongoId} from "class-validator";

enum RoleType {
    admin = "admin",
    member = "member",
}

export class ChangeRoleDto {
    @IsMongoId()
    id!: string;

    @IsEnum(RoleType)
    role!: RoleType;
}