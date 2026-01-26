import {Module} from "@nestjs/common";
import {ConfigModule} from "@nestjs/config";
import {MongooseModule} from "@nestjs/mongoose";

import {mongooseConfig} from "./config/db.config";
import {UsersModule} from "./module/user/user.module";
import {AuthModule} from "./module/auth/auth.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        MongooseModule.forRootAsync({
            useFactory: mongooseConfig
        }),
        AuthModule,
        UsersModule
    ]
})
export class AppModule {}