import {forwardRef, Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {FriendRequest, FriendRequestSchema} from "./schema/friendRequest.schema";
import {FriendService} from "./friend.service";
import {FriendController} from "./friend.controller";
import {ConversationModule} from "../conversation/conversation.module";
import {NotificationModule} from "../notification/notification.module";
import {ChatModule} from "../../gateway/chat.module";

@Module({
    imports: [
        forwardRef(() => ConversationModule),
        ChatModule,
        NotificationModule,
        MongooseModule.forFeature([{
            name: FriendRequest.name,
            schema: FriendRequestSchema,
            collection: "friendRequests"
        }]),
    ],
    providers: [FriendService],
    controllers: [FriendController],
    exports: [FriendService]
})
export class FriendModule {
}