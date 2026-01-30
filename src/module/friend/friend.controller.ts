import {Controller, Post, HttpCode, UseGuards, Req, Body} from "@nestjs/common";
import {Types} from "mongoose";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";

import {FriendService} from "./friend.service";
import {JwtType} from "../../common/types/jwtTypes.type";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {SendRequestDto} from "./dto/sendRequest.dto";

@Controller("friends")
export class FriendController {
    constructor(
        private readonly friendRequestService: FriendService
    ) {}

    @UseGuards(JwtAuthGuard)
    @HttpCode(201)
    @Post("request")
    async makeFriend(
        @JwtDecode() user: JwtType,
        @Body() dto: SendRequestDto,
    ) {
        const userIdSend  = new Types.ObjectId(dto.userId);
        return this.friendRequestService.makeFriend(
            user.userId,
            userIdSend,
            dto.message
        );
    }
}