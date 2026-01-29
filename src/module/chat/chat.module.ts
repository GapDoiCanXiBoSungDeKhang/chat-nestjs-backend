import {Module} from "@nestjs/common";
import {JwtModule} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";

import {ChatGateway} from "./chat.gateway";
import {ConversationModule} from "../conversation/conversation.module";
import {MessageModule} from "../message/message.module";

@Module({
    imports: [
        MessageModule,
        ConversationModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>("JWT_SECRET")
            })
        })
    ],
    providers: [ChatGateway],
    exports: [ChatGateway]
})
export class ChatModule {}