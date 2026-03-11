import {Module} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {JwtModule} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";

import {UsersModule} from "../user/user.module";
import {AuthController} from "./auth.controller";
import {AuthService} from "./auth.service";
import {LocalStrategy} from "./strategies/local.strategies";
import {JwtStrategy} from "./strategies/jwt.strategies";

@Module({
    imports: [
        UsersModule,
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>("JWT_SECRET"),
            })
        })
    ],
    providers: [
        LocalStrategy,
        JwtStrategy,
        AuthService
    ],
    controllers: [AuthController],
})
export class AuthModule {
}