import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors
} from "@nestjs/common";

import {UserService} from "./user.service";

import {JwtAuthGuard} from "../auth/guards/jwt-auth.guard";
import {JwtDecode} from "../../common/decorators/jwt.decorator";
import {JwtType} from "../../common/types/jwtTypes.type";
import {BlockedUser, ProfileDto} from "./dto/paramUserId.dto";
import {UpdateStatusDto} from "./dto/updateStatus.dto";
import {UpdatePrivacyDto} from "./dto/updatePrivacy.dto";
import {findUserByPhoneNumberDto} from "./dto/findUserByPhoneNumber.dto";
import {findUserByName} from "./dto/findUserByName.dto";
import {updateProfileDto} from "./dto/updateProfile.dto";
import {FileInterceptor} from "@nestjs/platform-express";
import {createMulterOptions} from "../../shared/upload/upload.config";

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

    @Get("privacy")
    public async getPrivacy(@JwtDecode() user: JwtType) {
        return this.userService.getPrivacy(user.userId);
    }

    @Get(":userId/profile")
    public async getProfile(
        @JwtDecode() viewer: JwtType,
        @Param() param: ProfileDto,
    ) {
        return this.userService.getProfileWithPrivacy(param.userId, viewer.userId);
    }

    @Get("find/phone")
    public async findUserByPhoneNumber(@Body() dto: findUserByPhoneNumberDto) {
        return this.userService.findUserByPhoneNumber(dto.phone);
    }

    @Get("find/name")
    public async findUserByName(@Query() dto: findUserByName) {
        return this.userService.findUserByName(dto.name);
    }

    @Patch("edit/profile")
    @UseInterceptors(
        FileInterceptor(
            "file",
            createMulterOptions("media")
        )
    )
    public async updateProfile(
        @UploadedFile() file: Express.Multer.File,
        @JwtDecode() user: JwtType,
        @Body() dto: updateProfileDto
    ) {
        return this.userService.updateProfile(user.userId, dto, file);
    }
}