import {Controller, Post, HttpCode, UseGuards, Req, Body} from "@nestjs/common";
import {Types} from "mongoose";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";

import {FriendService} from "./friend.service";
import {JwtType} from "../../common/types/jwtTypes.type";

import {JwtDecode} from "../../common/decorators/jwt.decorator";

@Controller("friend")
export class FriendController {
    constructor(
        private readonly friendRequestService: FriendService
    ) {}

    @UseGuards(JwtAuthGuard)
    @HttpCode(201)
    @Post("make-friend")
    async makeFriend(
        @Body("userId") userId: string,
        @JwtDecode() user: JwtType
    ) {
        const userIdSend  = new Types.ObjectId(userId);
        return this.friendRequestService.makeFriend(user.userId, userIdSend);
    }
}