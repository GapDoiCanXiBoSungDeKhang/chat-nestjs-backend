import {Body, Controller, HttpCode, Post, UseGuards} from "@nestjs/common";

import {InputRegisterUserDto} from "./dto/inputRegister.dto";
import {AuthService} from "./auth.service";
import {LocalAuthGuard} from "./guards/local-auth.guard";

import {UserDocument} from "../user/schema/user.schema";
import {User} from "../../common/decorators/user.decorator";

@Controller("auth")
export class AuthController {
    constructor(
        private readonly authService: AuthService
    ) {}

    @Post("register")
    @HttpCode(201)
    async register(@Body() body: InputRegisterUserDto) {
        return this.authService.register(body);
    }

    @UseGuards(LocalAuthGuard)
    @Post("login")
    @HttpCode(200)
    async login(@User() user: UserDocument) {
        return this.authService.login(user);
    }
}