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

    async getCall(callId: string): Promise<{
        callId: string;
        callerId: string;
        calleeId?: string;
        conversationId?: string;
        callType: "voice" | "video";
        isGroup: boolean;
        participants: Set<string>;
    } | null> {
        const [raw, members] = await Promise.all([
            this.redis.hgetall(`call:${callId}`),
            this.redis.smembers(`call:${callId}:members`),
        ]);
 
        if (!raw || !raw.callId) return null;
 
        return {
            callId: raw.callId,
            callerId: raw.callerId,
            calleeId: raw.calleeId || undefined,
            conversationId: raw.conversationId || undefined,
            callType: raw.callType as "voice" | "video",
            isGroup: raw.isGroup === "1",
            participants: new Set(members),
        };
    }

    // ─── Thêm participant ─────────────────────────────────────────────────────
 
    async addParticipant(callId: string, userId: string): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.sadd(`call:${callId}:members`, userId); // thêm thành viên mới.
        pipeline.expire(`call:${callId}:members`, this.CALL_TTL); // tự động giải phóng dữ liệu, rác, ..., tránh tồn dữ liệu đã sử dụng hoặc không mong muốn.
        pipeline.set(`user:${userId}:callId`, callId, "EX", this.CALL_TTL); // set biết user đang ở phòng nào.
        await pipeline.exec();
    }

    // ─── Xoá participant ──────────────────────────────────────────────────────
 
    async removeParticipant(callId: string, userId: string): Promise<number> {
        const pipeline = this.redis.pipeline();
        pipeline.srem(`call:${callId}:members`, userId);
        pipeline.del(`user:${userId}:callId`);
        await pipeline.exec();
        // Trả về số member còn lại sau khi xoá
        return await this.redis.scard(`call:${callId}:members`);
    }

    // ─── Xoá toàn bộ call ────────────────────────────────────────────────────
 
    async deleteCall(callId: string, participantIds: string[]): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.del(`call:${callId}`);
        pipeline.del(`call:${callId}:members`);
        for (const uid of participantIds) {
            pipeline.del(`user:${uid}:callId`);
        }
        await pipeline.exec();
    }

    // ─── Kiểm tra user có đang trong call không ───────────────────────────────
 
    async getUserCallId(userId: string): Promise<string | null> {
        return this.redis.get(`user:${userId}:callId`);
    }
 
    async isUserInCall(userId: string): Promise<boolean> {
        return !!(await this.redis.exists(`user:${userId}:callId`));
    }

    // ─── Lấy danh sách participants ───────────────────────────────────────────
 
    async getParticipants(callId: string): Promise<string[]> {
        return this.redis.smembers(`call:${callId}:members`);
    }
 
    async getParticipantCount(callId: string): Promise<number> {
        return this.redis.scard(`call:${callId}:members`);
    }
}