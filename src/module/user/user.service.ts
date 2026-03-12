import {BadRequestException, Injectable, NotFoundException} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {User, UserDocument} from "./schema/user.schema";
import {registerDto} from "../auth/dto/register.dto";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";
import {BlockedUser, BlockedUserDocument} from "./schema/blockedUser.schema";
import {UpdateStatusDto} from "./dto/updateStatus.dto";
import {ChatGateway} from "../../gateway/chat.gateway";
import {UpdatePrivacyDto} from "./dto/updatePrivacy.dto";

@Injectable()
export class UserService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(BlockedUser.name)
        private readonly blockUserModel: Model<BlockedUserDocument>,
        private readonly chatGateway: ChatGateway,
    ) {
    }

    public async users() {
        return this.userModel.find({}).lean();
    }

    public async create(dto: registerDto) {
        const user = new this.userModel(dto);
        return user.save();
    }

    public async findById(userId: string) {
        return this.userModel.findById(convertStringToObjectId(userId)).lean();
    }

    public async findByEmail(email: string) {
        return !!(await this.userModel.findOne({email}));
    }

    public async getInfoByEmail(email: string) {
        return this.userModel.findOne({email}).lean();
    }

    public async findByPhoneNumber(phoneNumber: string) {
        return !!(await this.userModel.findOne({phoneNumber}));
    }

    public async updateRefreshToken(userId: string, token: string | null) {
        await this.userModel.findByIdAndUpdate(
            convertStringToObjectId(userId),
            {refreshToken: token}
        );
    }

    public async listUser(userId: string) {
        // const objIds = userIds.map(uid => convertStringToObjectId(uid));
        return this.userModel.find(
            {_id: {$ne: convertStringToObjectId(userId)}},
            {
                _id: 1,
                name: 1
            }
        ).lean();
    }

    public async getInfoUserIds(userIds: string[]) {
        const objIds = userIds.map((userId) => convertStringToObjectId(userId));
        return this.userModel.find(
            {_id: {$in: objIds}},
            {
                name: 1,
                avatar: 1,
                status: 1,
            }
        ).lean();
    }

    public async getInfoById(userId: string) {
        const user = await this.userModel.findById(
            convertStringToObjectId(userId),
            {
                _id: 1,
                name: 1,
                avatar: 1,
            }
        );
        if (!user) {
            throw new NotFoundException("User not found");
        }
        return user;
    }

    public async getUserValid(userIds: string[]) {
        return this.userModel.find(
            {
                _id: {
                    $in: userIds.map(
                        uid => convertStringToObjectId(uid)
                    )
                }
            }).lean();
    }

    public async setOnline(userId: string) {
        await this.userModel.findByIdAndUpdate(
            convertStringToObjectId(userId),
            { status: "online", lastSeen: null }
        );
    }

    public async setOffline(userId: string) {
        await this.userModel.findByIdAndUpdate(
            convertStringToObjectId(userId),
            { status: "offline", lastSeen: new Date() }
        );
    }

    public async blockUser(myUserId: string, userId: string) {
        if (myUserId === userId) throw new BadRequestException("Can't block yourself");
        const checkExitsUser = await this.findById(userId);
        if (!checkExitsUser) throw new NotFoundException("User not found");
        await this.blockUserModel.findOneAndUpdate(
            {blockerId: convertStringToObjectId(myUserId), blockedId: convertStringToObjectId(userId)},
            {},
            {upsert: true}
        );
        return {success: true};
    }

    public async unblockUser(myUserId: string, userId: string) {
        if (myUserId === userId) throw new BadRequestException("Can't unblock yourself");
        const checkExitsUser = await this.findById(userId);
        if (!checkExitsUser) throw new NotFoundException("User not found");
        await this.blockUserModel.deleteOne({
            blockerId: convertStringToObjectId(myUserId),
            blockedId: convertStringToObjectId(userId),
        });
        return {success: true};
    }

    public async getBlocked(myUserId: string) {
        return this.blockUserModel.find({
            blockerId: convertStringToObjectId(myUserId),
        })
            .populate("blockedId", "name status avatar")
            .lean();
    }

    public async isBlocked(myUserId: string, userId: string) {
        const objMyId = convertStringToObjectId(myUserId);
        const objUserId = convertStringToObjectId(userId);
        const record = await this.blockUserModel.findOne({
            $or: [
                {blockerId: objMyId, blockedId: objUserId},
                {blockerId: objUserId, blockedId: objMyId},
            ],
        });
        return !!record;
    }

    public async updateCustomStatus(userId: string, dto: UpdateStatusDto) {
        const updated = await this.userModel.findByIdAndUpdate(
            convertStringToObjectId(userId),
            {
                status: dto.status,
                customStatusMessage: dto.customStatusMessage ?? null,
                ...(dto.status === "offline" ? { lastSeen: new Date() } : { lastSeen: null }),
            },
            { new: true, select: "status customStatusMessage lastSeen" }
        );
        if (!updated) throw new NotFoundException("User not found");
        this.chatGateway.emitStatusChanged(
            userId,
            updated.status,
            updated.customStatusMessage ?? null,
            updated.lastSeen ?? null,
        );
        return updated;
    }

    public async updatePrivacy(userId: string, dto: UpdatePrivacyDto) {
        const updateFields: Record<string, any> = {}
        if (dto.lastSeenVisibility  !== undefined)
            updateFields["privacy.lastSeenVisibility"] = dto.lastSeenVisibility;
        if (dto.showReadReceipts !== undefined)
            updateFields["privacy.showReadReceipts"] = dto.showReadReceipts;
        if (dto.showTypingIndicator !== undefined)
            updateFields["privacy.showTypingIndicator"] = dto.showTypingIndicator;
        const updated = await this.userModel.findByIdAndUpdate(
            convertStringToObjectId(userId),
            {$set: updateFields},
            {new: true, select: "privacy"},
        );
        if (!updated) throw new NotFoundException("User not found");

        return updated;
    }
}