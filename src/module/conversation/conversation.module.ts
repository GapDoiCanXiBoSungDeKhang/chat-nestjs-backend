import {forwardRef, Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {Conversation, ConversationSchema} from "./schema/conversation.schema";

import {UsersModule} from "../user/user.module";

import {ConversationService} from "./conversation.service";
import {ConversationController} from "./conversation.controller";

import {ConversationParticipantGuard} from "./guard/conversation-participant.guard";
import {MessageModule} from "../message/message.module";

@Module({
    imports: [
        forwardRef(() => MessageModule),
        UsersModule,
        MongooseModule.forFeature([{
            name: Conversation.name,
            schema: ConversationSchema,
            collection: "conversations"
        }]),
    ],
    providers: [
        ConversationService,
        ConversationParticipantGuard
    ],
    controllers: [ConversationController],
    exports: [
        ConversationService,
        ConversationParticipantGuard
    ],
})
export class ConversationModule {}