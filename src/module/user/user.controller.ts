import {Controller, Get, HttpCode, Param, Post, UseGuards} from "@nestjs/common";

import {UserService} from "./user.service";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";
import {BlockedUser} from "./dto/paramUserId.dto";

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

    @Post("block/:userId")
    @HttpCode(201)
    public async blockUser(
        @Param("userId") userId: BlockedUser["userId"],
        @JwtDecode() user: JwtType
    ) {
        return this.userService.blockUser(user.userId, userId);
    }
}