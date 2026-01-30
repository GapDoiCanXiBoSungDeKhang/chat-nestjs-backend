import {Module} from "@nestjs/common";
import {ConfigModule} from "@nestjs/config";
import {MongooseModule} from "@nestjs/mongoose";

import {mongooseConfig} from "./config/db.config";
import {UsersModule} from "./module/user/user.module";
import {AuthModule} from "./module/auth/auth.module";
import {ConversationModule} from "./module/conversation/conversation.module";
import {MessageModule} from "./module/message/message.module";
import {ChatModule} from "./module/chat/chat.module";
import {FriendModule} from "./module/friend/friend.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        MongooseModule.forRootAsync({
            useFactory: mongooseConfig
        }),
        AuthModule,
        UsersModule,
        ConversationModule,
        MessageModule,
        FriendModule,
        ChatModule
    ]
})
export class AppModule {}