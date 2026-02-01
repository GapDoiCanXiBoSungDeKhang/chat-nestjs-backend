import {Controller, Get, Post, Req, UseGuards} from "@nestjs/common";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";
import {NotificationService} from "./notification.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(
        private readonly notificationService: NotificationService
    ) {}

    @Get()
    async getNotifications(@JwtDecode() user: JwtType) {
        return this.notificationService.getAll(user.userId);
    }
}