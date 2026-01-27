import {CanActivate, ConflictException, ExecutionContext, Injectable} from "@nestjs/common";
import {Types} from "mongoose";

import {ConversationService} from "../conversation.service";

@Injectable()
export class ConversationParticipantGuard implements CanActivate {
    constructor(
        private readonly conversationService: ConversationService,
    ) {}

    async canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        const userId = new Types.ObjectId(req.user.userId);
        const conversationId = new Types.ObjectId(req.params.id);

        const findUser = await this.conversationService
            .findUserParticipants(
                userId,
                conversationId,
            );
        if (!findUser) {
            throw new ConflictException("User does not in private conversation");
        }
        return true;
    }
}