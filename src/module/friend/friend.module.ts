import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {FriendRequest, FriendRequestSchema} from "./schema/friendRequest.schema";
import {FriendService} from "./friend.service";
import {FriendController} from "./friend.controller";
import {ConversationModule} from "../conversation/conversation.module";

@Module({
    imports: [
        ConversationModule,
        MongooseModule.forFeature([{
            name: FriendRequest.name,
            schema: FriendRequestSchema,
            collection: "friendRequests"
        }]),
    ],
    providers: [FriendService],
    controllers: [FriendController],
})
export class FriendModule {}