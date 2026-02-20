import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";

import {ResponseJoinRoom, ResponseJoinRoomSchema} from "./schema/responseJoinRoom.schema";
import {ResponseJoinRoomService} from "./responseJoinRoom.service";

@Module({
    imports: [
        MongooseModule.forFeature([{
            name: ResponseJoinRoom.name,
            schema: ResponseJoinRoomSchema,
            collection: "responseJoinRooms"
        }])
    ],
    providers: [ResponseJoinRoomService],
    exports: [ResponseJoinRoomService]
})
export class ResponseJoinRoomModule {}