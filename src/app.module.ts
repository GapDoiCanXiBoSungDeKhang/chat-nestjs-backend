import {Module} from "@nestjs/common";
import {appController} from "./controller";

@Module({
    controllers: [appController],
})
export class AppModule {}