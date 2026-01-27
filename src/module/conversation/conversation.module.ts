import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {Conversation, ConversationSchema} from "./schema/conversation.schema";
import {UsersModule} from "../user/user.module";
import {ConversationService} from "./conversation.service";
import {ConversationController} from "./conversation.controller";

@Module({
    imports: [
        UsersModule,
        MongooseModule.forFeature([{
            name: Conversation.name,
            schema: ConversationSchema,
            collection: "conversations"
        }]),
    ],
    providers: [ConversationService],
    controllers: [ConversationController],
    exports: [ConversationService],
})
export class ConversationModule {}