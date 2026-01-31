import {Controller, Post, HttpCode, UseGuards, Req, Body, Patch, Param} from "@nestjs/common";
import {Types} from "mongoose";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";

import {FriendService} from "./friend.service";
import {JwtType} from "../../common/types/jwtTypes.type";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {SendRequestDto} from "./dto/sendRequest.dto";
import {ResRequestIdDto, ResResponseActionDto} from "./dto/responeRequest.dto";

@Controller("friends")
export class FriendController {
    constructor(
        private readonly friendRequestService: FriendService
    ) {}

    @UseGuards(JwtAuthGuard)
    @HttpCode(201)
    @Post("request")
    async sendRequest(
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

    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    @Patch("request/:id")
    async resRequest(
        @JwtDecode() user: JwtType,
        @Param("id") id: ResRequestIdDto["id"],
        @Body() data: ResResponseActionDto,
    ) {
        const requestId  = new Types.ObjectId(id);
        if (data.action === "accepted") {
            return this.friendRequestService.acceptedRequest(requestId, user.userId);
        }
        return {
            "test": true
        }
    }
}