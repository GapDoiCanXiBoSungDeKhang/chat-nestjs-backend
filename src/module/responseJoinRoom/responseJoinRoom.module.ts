import {Module} from "@nestjs/common";
import {MongooseModule} from "@nestjs/mongoose";
import {ResponseJoinRoom, ResponseJoinRoomSchema} from "./schema/responseJoinRoom.schema";

@Module({
    imports: [
        MongooseModule.forFeature([{
            name: ResponseJoinRoom.name,
            schema: ResponseJoinRoomSchema,
            collection: "responseJoinRooms"
        }])
    ]
})
export class ResponseJoinRoomModule {}