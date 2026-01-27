import {Controller, Post, HttpCode, UseGuards, Body} from "@nestjs/common";
import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";
import {ConversationService} from "./conversation.service";

@Controller("conversations")
export class ConversationController {
    constructor(
        private conversationService: ConversationService
    ) {}

    @UseGuards(JwtAuthGuard)
    @Post("private")
    @HttpCode(201)
    public async createConversation(
        @JwtDecode() user: JwtType,
        @Body("userId") userId: string
    ) {
        return this.conversationService.create(user.userId, userId);
    }
}