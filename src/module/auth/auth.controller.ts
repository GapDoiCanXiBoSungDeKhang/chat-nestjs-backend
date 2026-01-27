import {Body, Controller, HttpCode, Post, UseGuards} from "@nestjs/common";

import {InputRegisterUserDto} from "./dto/inputRegister.dto";
import {AuthService} from "./auth.service";

import {LocalAuthGuard} from "./guards/local-auth.guard";
import {JwtAuthGuard} from "./guards/jwt-auth.guard";

import {UserDocument} from "../user/schema/user.schema";
import {User} from "../../common/decorators/user.decorator";
import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";

@Controller("auth")
export class AuthController {
    constructor(
        private readonly authService: AuthService
    ) {}

    @Post("register")
    @HttpCode(201)
    public async register(@Body() body: InputRegisterUserDto) {
        return this.authService.register(body);
    }

    @UseGuards(LocalAuthGuard)
    @Post("login")
    @HttpCode(200)
    public async login(@User() user: UserDocument) {
        return this.authService.login(user);
    }

    @Post("refresh")
    @HttpCode(200)
    public async refresh(@Body("refreshToken") refreshToken: string) {
        return this.authService.refresh(refreshToken);
    }

    @UseGuards(JwtAuthGuard)
    @Post("logout")
    @HttpCode(200)
    public async logout(@JwtDecode() user: JwtType) {
        return this.authService.logout(user.userId);
    }
}