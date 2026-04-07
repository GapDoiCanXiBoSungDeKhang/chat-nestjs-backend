import {Inject, Injectable, Logger} from "@nestjs/common";
import Redis from "ioredis";
import {REDIS_CLIENT} from "./redis.module";

/**
 * RedisCacheService — cache cho conversation list và message pagination.
 *
 * ── Conversation cache ────────────────────────────────────────────────────────
 * Key:  conversations:{userId}:{active|archived}
 * TTL:  30 giây
 * Invalidate: khi có message mới, join/leave group, mark seen, v.v.
 *
 * ── Message page cache ────────────────────────────────────────────────────────
 * Key:  messages:{conversationId}:page:{cursor}:{limit}
 *         cursor = "first" (trang đầu, không có before) hoặc ObjectId của before
 * TTL:  60 giây
 * Invalidate: khi có message mới, edit, delete, react/unreact trong conversation đó.
 *
 * Lưu ý: Chỉ cache GET messages (read). Write operations luôn đi thẳng MongoDB.
 */

@Injectable()
export class RedisCacheService {
    private readonly logger = new Logger(RedisCacheService.name);
 
    private readonly CONVERSATIONS_TTL = 30;   // 30 giây

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis
    ) {
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONVERSATION LIST CACHE
    // ═══════════════════════════════════════════════════════════════════════════
 
    private conversationKey(userId: string, archived: boolean): string {
        return `conversations:${userId}:${archived ? "archived" : "active"}`;
    }
 
    async getConversations(userId: string, archived: boolean): Promise<any[] | null> {
        try {
            const cached = await this.redis.get(this.conversationKey(userId, archived));
            if (!cached) return null;
            return JSON.parse(cached);
        } catch (err) {
            this.logger.warn(`[Cache] getConversations error: ${err}`);
            return null;
        }
    }
 
    async setConversations(userId: string, archived: boolean, data: any[]): Promise<void> {
        try {
            await this.redis.setex(
                this.conversationKey(userId, archived),
                this.CONVERSATIONS_TTL,
                JSON.stringify(data),
            );
        } catch (err) {
            this.logger.warn(`[Cache] setConversations error: ${err}`);
        }
    }
 
    /** Invalidate cả active lẫn archived cache của một user */
    async invalidateConversations(userId: string): Promise<void> {
        try {
            const pipeline = this.redis.pipeline();
            pipeline.del(this.conversationKey(userId, false));
            pipeline.del(this.conversationKey(userId, true));
            await pipeline.exec();
        } catch (err) {
            this.logger.warn(`[Cache] invalidateConversations error: ${err}`);
        }
    }
 
    /** Invalidate cache của nhiều users cùng lúc (vd: tất cả participants khi có message mới) */
    async invalidateConversationsMany(userIds: string[]): Promise<void> {
        if (!userIds.length) return;
        try {
            const pipeline = this.redis.pipeline();
            for (const uid of userIds) {
                pipeline.del(this.conversationKey(uid, false));
                pipeline.del(this.conversationKey(uid, true));
            }
            await pipeline.exec();
        } catch (err) {
            this.logger.warn(`[Cache] invalidateConversationsMany error: ${err}`);
        }
    }

}