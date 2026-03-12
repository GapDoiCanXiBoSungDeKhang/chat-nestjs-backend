import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateStatusDto {
    @IsEnum(["online", "away", "busy", "offline"])
    status!: "online" | "away" | "busy" | "offline";

    @IsOptional()
    @IsString()
    @MaxLength(80)
    customStatusMessage?: string | null;
}