import {forwardRef, Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {UserController} from "./user.controller";
import {UserService} from "./user.service";

import {User, UserSchema} from "./schema/user.schema";
import {BlockedUser, BlockedUserSchema} from "./schema/blockedUser.schema";
import {BlockGuard} from "./guard/block.guard";
import {ConversationModule} from "../conversation/conversation.module";
import {ChatModule} from "../../gateway/chat.module";

@Module({
    imports: [
        ConversationModule,
        forwardRef(() => ChatModule),
        MongooseModule.forFeature([
            {
                name: User.name,
                schema: UserSchema,
                collection: "users"
            },
            {
                name: BlockedUser.name,
                schema: BlockedUserSchema,
                collection: "blockedUsers"
            }
        ]),
    ],
    providers: [
        UserService,
        BlockGuard
    ],
    controllers: [UserController],
    exports: [
        UserService,
        BlockGuard
    ],
})
export class UsersModule {
}