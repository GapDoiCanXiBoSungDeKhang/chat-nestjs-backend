import {Types} from "mongoose";
import {Body, Controller, Get, Param, Patch, Post, UseGuards} from "@nestjs/common";

import {MessageService} from "./message.service";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {ConversationParticipantGuard} from "../conversation/guard/conversation-participant.guard";

import {IdConversationDto} from "./dto/id-conversation.dto";
import {CreateMessageDto} from "./dto/body-create.dto";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";

@Controller("messages")
@UseGuards(JwtAuthGuard, ConversationParticipantGuard)
export class MessageController {
    constructor(
        private readonly messageService: MessageService
    ) {}

    @Post(":id")
    public async message(
        @Param("id") room: IdConversationDto["id"],
        @Body() body: CreateMessageDto,
        @JwtDecode() user: JwtType
    ) {
        return this.messageService.create(
            user.userId,
            room,
            body.content
        );
    }

    @Get(":id")
    public async getMessages(
        @Param("id") room: IdConversationDto["id"],
    ) {
        return this.messageService.messages(room);
    }

    @Patch(":id/seen")
    public async markAsSeen(
        @Param("id") room: IdConversationDto["id"],
        @JwtDecode() user: JwtType
    ) {
        return this.messageService.markAsSeen(
            room,
            user.userId
        );
    }
}