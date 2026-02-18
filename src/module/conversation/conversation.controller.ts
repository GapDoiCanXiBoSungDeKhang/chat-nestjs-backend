import {Controller, Post, HttpCode, UseGuards, Body, Get} from "@nestjs/common";
import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";
import {ConversationService} from "./conversation.service";
import {CreatePrivateConversationDto} from "./dto/createPrivate.dto";
import {CreateGroupDto} from "./dto/createGroup.dto";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class ConversationController {
    constructor(
        private conversationService: ConversationService
    ) {
    }

    @Post("private")
    @HttpCode(201)
    public async createConversation(
        @JwtDecode() user: JwtType,
        @Body() dto: CreatePrivateConversationDto
    ) {
        return this.conversationService.create(user.userId, dto.userId);
    }

    @Post("group")
    @HttpCode(201)
    public async createConversationGroup(
        @JwtDecode() user: JwtType,
        @Body() dto: CreateGroupDto
    ) {
        return this.conversationService.createGroup(
            user.userId,
            dto.name,
            dto.groupIds
        );
    }

    @Get("")
    @HttpCode(201)
    public async conversations(@JwtDecode() user: JwtType) {
        return this.conversationService.getAllConversations(user.userId);
    }

    @Get("list-user")
    @HttpCode(201)
    public async users(@JwtDecode() user: JwtType) {
        return this.conversationService.users(user.userId);
    }
}