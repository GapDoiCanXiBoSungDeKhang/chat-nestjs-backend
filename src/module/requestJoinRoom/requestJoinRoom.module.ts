import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {ResponseJoinRoom, RequestJoinRoomSchema} from "./schema/requestJoinRoom.schema";
import {RequestJoinRoomService} from "./requestJoinRoom.service";

@Module({
    imports: [
        MongooseModule.forFeature([{
            name: ResponseJoinRoom.name,
            schema: RequestJoinRoomSchema,
            collection: "requestJoinRooms"
        }])
    ],
    providers: [RequestJoinRoomService],
    exports: [RequestJoinRoomService]
})
export class RequestJoinRoomModule {
}