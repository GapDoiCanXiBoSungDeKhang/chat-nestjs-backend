import {Controller, Get, HttpCode, UseGuards} from "@nestjs/common";

import {UserService} from "./user.service";
import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UserController {
    constructor(
        private readonly userService: UserService,
    ) {
    }

    @Get()
    @HttpCode(200)
    public async getUsers() {
        return this.userService.users();
    }
}