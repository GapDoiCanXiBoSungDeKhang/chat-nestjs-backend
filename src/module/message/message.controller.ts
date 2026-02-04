import {Body, Controller, Get, Param, Patch, Post, UseGuards, Query, Delete} from "@nestjs/common";

import {MessageService} from "./message.service";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {ConversationParticipantGuard} from "../conversation/guard/conversation-participant.guard";

import {IdConversationDto} from "./dto/id-conversation.dto";
import {CreateMessageDto} from "./dto/body-create.dto";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";
import {ReactEmojiDto} from "./dto/reactEmoji.dto";
import {EditMessageDto} from "./dto/editMessage.dto";
import {DeleteMessageDto} from "./dto/deleteMessage.dto";
import {QueryDeleteMessageDto} from "./dto/queryDeleteMessage.dto";

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
            body.content,
            body?.replyTo
        );
    }

    @Patch(":id")
    public async editMessage(
        @JwtDecode() user: JwtType,
        @Body() body: EditMessageDto
    ) {
        return this.messageService.edit(
            user.userId,
            body.content,
            body.id
        )
    }

    @Get(":id")
    public async getMessages(
        @Param("id") room: IdConversationDto["id"],
    ) {
        return this.messageService.messages(room);
    }

    @Patch("/:id/react")
    public async reactMessage(
        @JwtDecode() user: JwtType,
        @Body() dto: ReactEmojiDto
    ) {
        return this.messageService.react(dto.id, user.userId, dto.emoji);
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

    @Delete(":id")
    public async deleteMessage(
        @JwtDecode() user: JwtType,
        @Body() body: DeleteMessageDto,
        @Query() query: QueryDeleteMessageDto
    ) {
        return this.messageService.delete(
            body.id,
            user.userId,
            query.scope
        );
    }
}