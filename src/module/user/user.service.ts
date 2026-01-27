import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model, Types} from "mongoose";

import {User, UserDocument} from "./schema/user.schema";
import {registerDto} from "../auth/dto/register.dto";

@Injectable()
export class UserService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>
    ) {}

    async users() {
        return this.userModel.find({}).lean();
    }

    async create(dto: registerDto) {
        const user = new this.userModel(dto);
        return user.save();
    }

    async findById(userId: string) {
        const id = new Types.ObjectId(userId);
        return this.userModel.findById(id).lean();
    }

    async findByEmail(email: string) {
        return !!(await this.userModel.findOne({email}));
    }

    async getInfoByEmail(email: string) {
        return this.userModel.findOne({email}).lean();
    }

    async findByPhoneNumber(phoneNumber: string) {
        return !!(await this.userModel.findOne({phoneNumber}));
    }

    async updateRefreshToken(userId: Types.ObjectId, token: string) {
        await this.userModel.findByIdAndUpdate(
            userId,
            {refreshToken: token}
        );
    }
}