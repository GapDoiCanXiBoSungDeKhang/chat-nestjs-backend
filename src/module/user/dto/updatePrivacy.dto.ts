import { IsBoolean, IsEnum, IsOptional } from "class-validator";

export class UpdatePrivacyDto {
    @IsOptional()
    @IsEnum(["everyone", "friends", "nobody"])
    lastSeenVisibility?: "everyone" | "friends" | "nobody";

    @IsOptional()
    @IsBoolean()
    showReadReceipts?: boolean;

    @IsOptional()
    @IsBoolean()
    showTypingIndicator?: boolean;
}