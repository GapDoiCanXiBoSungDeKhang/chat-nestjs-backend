import {Controller, Post, HttpCode, UseGuards, Body, Get, Param, Patch} from "@nestjs/common";
import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";
import {ConversationService} from "./conversation.service";
import {CreatePrivateConversationDto} from "./dto/createPrivate.dto";
import {CreateGroupDto} from "./dto/createGroup.dto";
import {ConversationIdDto} from "./dto/conversationId.dto";
import {AddMemberDto} from "./dto/addMember.dto";

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

    @Get(":id/info")
    @HttpCode(200)
    public async getInfoPrivate(
        @Param("id") room: ConversationIdDto["id"]
    ) {
        return this.conversationService.infoConversation(room);
    }

    @Get(":id/info/media")
    @HttpCode(200)
    public async getInfoMedia(
        @Param("id") room: ConversationIdDto["id"]
    ) {
        return this.conversationService.infoMediaConversation(room);
    }

    @Get(":id/info/file")
    @HttpCode(200)
    public async getInfoFile(
        @Param("id") room: ConversationIdDto["id"]
    ) {
        return this.conversationService.infoFileConversation(room);
    }

    @Get(":id/info/link-preview")
    @HttpCode(200)
    public async getInfoLinkPreview(
        @Param("id") room: ConversationIdDto["id"]
    ) {
        return this.conversationService.infoLinkPreviewConversation(room);
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

    @Patch(":id/member")
    @HttpCode(200)
    public async addMember(
        @JwtDecode() user: JwtType,
        @Param("id") room: ConversationIdDto["id"],
        @Body() dto: AddMemberDto
    ) {
        return this.conversationService.addMembers(
            room,
            user.userId,
            dto.userIds
        )
    }

    @Get("")
    @HttpCode(200)
    public async conversations(@JwtDecode() user: JwtType) {
        return this.conversationService.getAllConversations(user.userId);
    }

    @Get("list-user")
    @HttpCode(201)
    public async users(@JwtDecode() user: JwtType) {
        return this.conversationService.users(user.userId);
    }
}