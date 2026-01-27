import {Types} from "mongoose";
import {Body, Controller, Get, Param, Post, UseGuards} from "@nestjs/common";

import {MessageService} from "./message.service";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {ConversationParticipantGuard} from "../conversation/guard/conversation-participant.guard";

import {IdConversationDto} from "./dto/id-conversation.dto";
import {CreateMessageDto} from "./dto/body-create.dto";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";

@Controller("messages")
export class MessageController {
    constructor(
        private readonly messageService: MessageService
    ) {}

    @UseGuards(JwtAuthGuard, ConversationParticipantGuard)
    @Post(":id")
    async message(
        @Param("id") room: IdConversationDto["id"],
        @Body() body: CreateMessageDto,
        @JwtDecode() user: JwtType
    ) {
        const conversationId = new Types.ObjectId(room);
        return this.messageService.create(
            user.userId,
            conversationId,
            body.content
        );
    }

    @UseGuards(JwtAuthGuard, ConversationParticipantGuard)
    @Get(":id")
    async getMessages(
        @Param("id") room: IdConversationDto["id"],
    ) {
        const conversationId = new Types.ObjectId(room);
        return this.messageService.messages(conversationId);
    }
}