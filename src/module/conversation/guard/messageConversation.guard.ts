import {CanActivate, ConflictException, ExecutionContext, Injectable, NotFoundException} from "@nestjs/common";

import {ConversationService} from "../conversation.service";

@Injectable()
export class MessageConversationGuard implements CanActivate {
    constructor(
        private readonly conversationService: ConversationService
    ) {}

    async canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        const messageId: string = req.body.id;
        const conversationId: string = req.params.id;

        const findConversation = await this.conversationService.findById(conversationId);
        if (!findConversation) {
            throw new NotFoundException("conversation not found!");
        }
        if (findConversation._id.toString() === messageId) {
            throw new ConflictException("message not in conversation!");
        }

        return true;
    }
}