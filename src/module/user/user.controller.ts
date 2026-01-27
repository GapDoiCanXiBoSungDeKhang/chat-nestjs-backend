import {Controller, Get, HttpCode} from "@nestjs/common";

import {UserService} from "./user.service";

@Controller("users")
export class UserController {
    constructor(
        private readonly userService: UserService,
    ) {}

    @Get()
    @HttpCode(200)
    public async getUsers() {
        return this.userService.users();
    }
}