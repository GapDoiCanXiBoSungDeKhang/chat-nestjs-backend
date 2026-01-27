import {forwardRef, Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {Message, MessageSchema} from "./schema/message.schema";
import {ConversationModule} from "../conversation/conversation.module";
import {MessageService} from "./message.service";
import {MessageController} from "./message.controller";

@Module({
    imports: [
        forwardRef(() => ConversationModule),
        MongooseModule.forFeature([{
            name: Message.name,
            schema: MessageSchema,
            collection: "messages",
        }])
    ],
    providers: [MessageService],
    controllers: [MessageController],
    exports: [MessageService],
})
export class MessageModule {}