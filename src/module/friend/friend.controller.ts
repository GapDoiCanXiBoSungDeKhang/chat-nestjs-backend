import {Controller, Post, HttpCode, UseGuards, Body, Patch, Param, Get, Delete} from "@nestjs/common";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";

import {FriendService} from "./friend.service";
import {JwtType} from "../../common/types/jwtTypes.type";

import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {SendRequestDto} from "./dto/sendRequest.dto";
import {ResRequestIdDto, ResResponseActionDto} from "./dto/responeRequest.dto";
import {UnfriendDto} from "./dto/unfriend.dto";

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
        return this.friendRequestService.makeFriend(
            user.userId,
            dto.userId,
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
        return data.action === "accepted"
            ? this.friendRequestService.acceptedRequest(id, user.userId)
            : this.friendRequestService.rejectedRequest(id, user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    @Get("requests")
    async requests(@JwtDecode() user: JwtType) {
        return this.friendRequestService.request(user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    @Get()
    async friends(@JwtDecode() user: JwtType) {
        return this.friendRequestService.friends(user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    @Delete(":id")
    async unfriend(
        @Param("id") userId: UnfriendDto["id"],
        @JwtDecode() user: JwtType
    ) {
        return this.friendRequestService.unfriend(user.userId, userId);
    }
}