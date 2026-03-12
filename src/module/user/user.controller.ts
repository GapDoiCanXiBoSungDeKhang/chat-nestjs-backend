import {Body, Controller, Delete, Get, Param, Patch, Post, UseGuards} from "@nestjs/common";

import {UserService} from "./user.service";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";
import {BlockedUser} from "./dto/paramUserId.dto";
import {UpdateStatusDto} from "./dto/updateStatus.dto";
import {UpdatePrivacyDto} from "./dto/updatePrivacy.dto";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UserController {
    constructor(
        private readonly userService: UserService,
    ) {
    }

    @Get()
    public async getUsers() {
        return this.userService.users();
    }

    @Post("block/:userId")
    public async blockUser(
        @Param("userId") userId: BlockedUser["userId"],
        @JwtDecode() user: JwtType
    ) {
        return this.userService.blockUser(user.userId, userId);
    }

    @Delete("block/:userId")
    public async deleteUser(
        @Param("userId") userId: BlockedUser["userId"],
        @JwtDecode() user: JwtType
    ) {
        return this.userService.unblockUser(user.userId, userId);
    }

    @Get("blocked")
    public async getBlockedUsers(
        @Param("userId") userId: BlockedUser["userId"],
        @JwtDecode() user: JwtType
    ) {
        return this.userService.getBlocked(user.userId);
    }

    @Patch("status")
    public async updateStatus(
        @JwtDecode() user: JwtType,
        @Body() dto: UpdateStatusDto,
    ) {
        return this.userService.updateCustomStatus(user.userId, dto);
    }

    @Patch("privacy")
    public async updatePrivacy(
        @JwtDecode() user: JwtType,
        @Body() dto: UpdatePrivacyDto,
    ) {
        return this.userService.updatePrivacy(user.userId, dto);
    }
}