import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {User, UserDocument} from "./schema/user.schema";
import {registerDto} from "../auth/dto/register.dto";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class UserService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>
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
        return this.userModel.findById(
            convertStringToObjectId(userId),
            {
                name: 1,
            }
        );
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
}