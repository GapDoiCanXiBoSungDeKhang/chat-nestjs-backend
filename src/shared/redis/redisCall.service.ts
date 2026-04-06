import {Inject, Injectable} from "@nestjs/common";
import Redis from "ioredis";
import {REDIS_CLIENT} from "./redis.module";

/**
 * RedisCallService — quản lý trạng thái cuộc gọi trên Redis thay vì in-memory Map.
 *
 * Schema Redis:
 *   call:{callId}            → Hash  { callId, callerId, calleeId?, conversationId?, callType, isGroup }
 *   call:{callId}:members    → Set   { userId, userId, ... }
 *   user:{userId}:callId     → String callId   (TTL = 2h)
 *
 * TTL 2 giờ tự xoá call bị abandon (client crash không emit call_end).
 */
@Injectable()
export class RedisCallService {
    private readonly CALL_TTL = 7200;
    
    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis
    ) {
    }

    async createCall(data: {
        callId: string;
        callerId: string;
        calleeId?: string;
        conversationId?: string;
        callType: "voice" | "video";
        isGroup: boolean;
    }): Promise<void> {
        const key = `call:${data.callId}`; // key redis giống với hashMap
        const pipeline = this.redis.pipeline(); // tạo hộp để chứa các lệnh -> gửi luôn một lần khỏi cần mỗi câu lệnh dùng await -> lâu

        pipeline.hset(key, {
            callId: data.callId,
            callerId: data.callerId,
            calleeId: data.calleeId ?? "",
            conversationId: data.conversationId ?? "",
            callType: data.callType,
            isGroup: data.isGroup ? "1" : "0",
        });
        pipeline.expire(key, this.CALL_TTL);

        // Thêm caller vào members set
        pipeline.sadd(`call:${data.callId}:members`, data.callerId);
        pipeline.expire(`call:${data.callId}:members`, this.CALL_TTL);

        // Map user → callId (tác dụng kiểm tra xem user có đang bận trong cuộc hợp nào không?)
        pipeline.set(`user:${data.callerId}:callId`, data.callId, "EX", this.CALL_TTL);

        await pipeline.exec();
    }
}