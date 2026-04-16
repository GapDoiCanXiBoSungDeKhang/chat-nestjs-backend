import {IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min} from "class-validator";
import {Type} from "class-transformer";

/**
 * DTO dùng nội bộ khi gateway tạo call message.
 * Không expose ra HTTP endpoint — chỉ dùng qua MessageService.createCallMessage().
 */
export class CreateCallMessageDto {
    @IsMongoId()
    conversationId!: string;

    /** userId của người gọi (callerId) */
    @IsMongoId()
    callerId!: string;

    @IsEnum(["voice", "video"])
    callType!: "voice" | "video";

    @IsEnum(["missed", "cancelled", "ended"])
    status!: "missed" | "cancelled" | "ended";

    /** Thời lượng cuộc gọi (giây) — chỉ set khi status = "ended" */
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    duration?: number;

    /** Thời điểm callee bắt máy — chỉ set khi status = "ended" */
    @IsOptional()
    startedAt?: Date;

    /** Thời điểm kết thúc cuộc gọi */
    @IsOptional()
    endedAt?: Date;

    /** Tất cả userId đã tham gia (caller + callee, hoặc group participants) */
    @IsOptional()
    @IsMongoId({each: true})
    participantIds?: string[];
}