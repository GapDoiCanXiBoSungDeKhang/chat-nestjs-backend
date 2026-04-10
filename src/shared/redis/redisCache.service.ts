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
    private readonly MESSAGES_TTL = 60;   // 60 giây

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

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGE PAGE CACHE
    // ═══════════════════════════════════════════════════════════════════════════
 
    /**
     * Tạo cache key cho một page messages.
     * cursor = "first" khi không có before (trang đầu tiên).
     * cursor = before ObjectId khi load thêm (infinite scroll).
     */
    private messagePageKey(
        conversationId: string,
        cursor: string,
        limit: number,
    ): string {
        return `messages:${conversationId}:page:${cursor}:${limit}`;
    }
 
    /**
     * Lấy một page messages từ cache.
     * Trả về null nếu không có (cache miss).
     */
    async getMessages(
        conversationId: string,
        limit: number,
        before?: string,
    ): Promise<any | null> {
        try {
            const cursor = before ?? "first";
            const key = this.messagePageKey(conversationId, cursor, limit);
            const cached = await this.redis.get(key);
            if (!cached) return null;
            this.logger.debug(`[Cache] HIT messages ${conversationId} cursor=${cursor}`);
            return JSON.parse(cached);
        } catch (err) {
            this.logger.warn(`[Cache] getMessages error: ${err}`);
            return null;
        }
    }
 
    /**
     * Lưu một page messages vào cache.
     * Đồng thời đăng ký key vào set theo dõi của conversation
     * để có thể invalidate tất cả pages khi cần.
     */
    async setMessages(
        conversationId: string,
        limit: number,
        data: any,
        before?: string,
    ): Promise<void> {
        try {
            const cursor = before ?? "first";
            const key = this.messagePageKey(conversationId, cursor, limit);
            const trackingKey = `messages:${conversationId}:keys`;
 
            const pipeline = this.redis.pipeline();
            // Lưu page data
            pipeline.setex(key, this.MESSAGES_TTL, JSON.stringify(data));
            // Đăng ký key vào tracking set (để invalidate sau)
            pipeline.sadd(trackingKey, key);
            // Tracking set có TTL dài hơn một chút để không bị xoá trước các pages
            pipeline.expire(trackingKey, this.MESSAGES_TTL + 60);
            await pipeline.exec();
        } catch (err) {
            this.logger.warn(`[Cache] setMessages error: ${err}`);
        }
    }
 
    /**
     * Invalidate TẤT CẢ cached pages của một conversation.
     *
     * Gọi khi:
     * - Có message mới gửi vào conversation
     * - Message bị edit (nội dung thay đổi)
     * - Message bị delete (isDeleted = true hoặc deletedFor)
     * - React/unreact (reactions array thay đổi)
     * - markAsSeen (seenBy array thay đổi)
     */
    async invalidateMessages(conversationId: string): Promise<void> {
        try {
            const trackingKey = `messages:${conversationId}:keys`;
            const keys = await this.redis.smembers(trackingKey);
 
            if (keys.length > 0) {
                const pipeline = this.redis.pipeline();
                // Xoá tất cả page keys đã đăng ký
                for (const k of keys) {
                    pipeline.del(k);
                }
                // Xoá tracking set
                pipeline.del(trackingKey);
                await pipeline.exec();
                this.logger.debug(
                    `[Cache] Invalidated ${keys.length} message pages for conversation ${conversationId}`,
                );
            }
        } catch (err) {
            this.logger.warn(`[Cache] invalidateMessages error: ${err}`);
        }
    }
}