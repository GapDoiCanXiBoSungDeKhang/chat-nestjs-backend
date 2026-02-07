import {Body, Controller, Get, Param, Patch, Post, UseGuards, Query, Delete} from "@nestjs/common";

import {MessageService} from "./message.service";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {ConversationParticipantGuard} from "../conversation/guard/conversationParticipant.guard";

import {IdConversationDto} from "./dto/id-conversation.dto";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";

import {CreateMessageDto} from "./dto/body-create.dto";
import {ReactEmojiDto} from "./dto/reactEmoji.dto";
import {EditMessageDto} from "./dto/editMessage.dto";
import {DeleteMessageDto} from "./dto/deleteMessage.dto";
import {QueryDeleteMessageDto} from "./dto/queryDeleteMessage.dto";
import {ForwardMessageDto} from "./dto/forwardMessage.dto";
import {MessageConversationGuard} from "../conversation/guard/messageConversation.guard";
import {UnreactEmojiDto} from "./dto/unreactEmoji.dto";

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
        const type: "text" | "file" | "image" | "forward" = "text";
        return this.messageService.create(
            user.userId,
            room,
            body.content,
            type,
            body?.replyTo,
        );
    }

    @UseGuards(MessageConversationGuard)
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

    @UseGuards(MessageConversationGuard)
    @Post("/:id/react")
    public async reactMessage(
        @JwtDecode() user: JwtType,
        @Body() dto: ReactEmojiDto
    ) {
        return this.messageService.react(
            dto.id,
            user.userId,
            dto.emoji
        );
    }

    @UseGuards(MessageConversationGuard)
    @Patch("/:id/unreact")
    public async unreactMessage(
        @JwtDecode() user: JwtType,
        @Body() dto: UnreactEmojiDto
    ) {
        return this.messageService.unreact(
            dto.id,
            user.userId,
        )
    }

    @UseGuards(MessageConversationGuard)
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

    @UseGuards(MessageConversationGuard)
    @Delete(":id")
    public async deleteMessage(
        @Param("id") room: IdConversationDto["id"],
        @JwtDecode() user: JwtType,
        @Body() body: DeleteMessageDto,
        @Query() query: QueryDeleteMessageDto
    ) {
        return this.messageService.delete(
            room,
            body.id,
            user.userId,
            query.scope
        );
    }

    @UseGuards(MessageConversationGuard)
    @Post(":id/forward")
    public async forwardMessage(
        @JwtDecode() user: JwtType,
        @Body() body: ForwardMessageDto
    ) {
        return this.messageService.forwardMessage(
            user.userId,
            body.id,
            body.conversationIds
        )
    }
}