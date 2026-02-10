import {forwardRef, Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {Message, MessageSchema} from "./schema/message.schema";
import {ConversationModule} from "../conversation/conversation.module";
import {MessageService} from "./message.service";
import {MessageController} from "./message.controller";
import {NotificationModule} from "../notification/notification.module";
import {ChatModule} from "../../gateway/chat.module";
import {UploadModule} from "../../shared/upload/upload.module";
import {CloudModule} from "../../shared/cloud/cloud.module";
import {AttachmentModule} from "../attachment/attachment.module";

@Module({
    imports: [
        AttachmentModule,
        CloudModule,
        UploadModule,
        ChatModule,
        NotificationModule,
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