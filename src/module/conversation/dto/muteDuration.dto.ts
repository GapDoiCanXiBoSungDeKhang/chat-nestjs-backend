import { IsEnum } from "class-validator";

export enum MuteDuration {
    H1 = "1h",
    H8 = "8h",
    H24 = "24h",
    FOREVER = "forever"
}

export class MuteDurationDto {
    @IsEnum(MuteDuration)
    duration!: MuteDuration;
}