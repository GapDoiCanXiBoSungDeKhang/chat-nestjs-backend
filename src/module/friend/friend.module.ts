import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {FriendRequest, FriendRequestSchema} from "./schema/friend.schema";
import {FriendService} from "./friend.service";
import {FriendController} from "./friend.controller";

@Module({
    imports: [
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