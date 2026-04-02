import {Body, Controller, HttpCode, Post, UseGuards} from "@nestjs/common";
import {Throttle} from "@nestjs/throttler";

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
    ) {
    }

    // FIX [SECURITY]: Thêm rate limit cho register — 2 lần/5 phút để chặn tạo fake accounts hàng loạt
    @Throttle({default: {limit: 2, ttl: 300000}})
    @Post("register")
    public async register(@Body() body: InputRegisterUserDto) {
        return this.authService.register(body);
    }

    // FIX [SECURITY]: Giảm login limit từ 5 xuống 3 lần/phút để hạn chế credential stuffing
    @UseGuards(LocalAuthGuard)
    @Throttle({default: {limit: 3, ttl: 60000}})
    @Post("login")
    public async login(@User() user: UserDocument) {
        return this.authService.login(user);
    }

    @Throttle({default: {limit: 5, ttl: 60000}})
    @Post("refresh")
    public async refresh(@Body("refreshToken") refreshToken: string) {
        return this.authService.refresh(refreshToken);
    }

    @UseGuards(JwtAuthGuard)
    @Post("logout")
    public async logout(@JwtDecode() user: JwtType) {
        return this.authService.logout(user.userId);
    }
}