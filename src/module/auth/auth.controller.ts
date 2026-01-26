import {Body, Controller, HttpCode, Post} from "@nestjs/common";

import {InputRegisterUserDto} from "./dto/inputRegister.dto";
import {AuthService} from "./auth.service";

@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post("register")
    @HttpCode(201)
    async register(@Body() body: InputRegisterUserDto) {
        return this.authService.register(body);
    }
}