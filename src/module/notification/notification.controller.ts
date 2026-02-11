import {Controller, Get, Param, Patch, UseGuards} from "@nestjs/common";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";
import {NotificationService} from "./notification.service";
import {MarkReadDto} from "./dto/markRead.dto";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(
        private readonly notificationService: NotificationService
    ) {
    }

    @Get()
    async getNotifications(@JwtDecode() user: JwtType) {
        return this.notificationService.getAll(user.userId);
    }

    @Get("unread-count")
    async getUnreadCount(@JwtDecode() user: JwtType) {
        const res = await this.notificationService.getCountUnread(user.userId);
        return {
            message: "success",
            unreadCount: res
        };
    }

    @Patch(":id/read")
    async markRead(
        @Param("id") id: MarkReadDto["id"],
        @JwtDecode() user: JwtType
    ) {
        return this.notificationService.markRead(id, user.userId);
    }

    @Patch("read-all")
    async markReadAll(@JwtDecode() user: JwtType) {
        return this.notificationService.markReadAll(user.userId);
    }
}