import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {UserController} from "./user.controller";
import {UserService} from "./user.service";

import {User, UserSchema} from "./schema/user.schema";
import {BlockedUser, BlockedUserSchema} from "./schema/blockedUser.schema";

@Module({
    imports: [
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
    providers: [UserService],
    controllers: [UserController],
    exports: [UserService],
})
export class UsersModule {
}