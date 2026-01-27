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

    public async users() {
        return this.userModel.find({}).lean();
    }

    public async create(dto: registerDto) {
        const user = new this.userModel(dto);
        return user.save();
    }

    public async findById(userId: string) {
        const id = new Types.ObjectId(userId);
        return this.userModel.findById(id).lean();
    }

    public async findByEmail(email: string) {
        return !!(await this.userModel.findOne({email}));
    }

    async findByObjectId(id: Types.ObjectId) {
        return !!(await this.userModel.findById(id));
    }

    public async getInfoByEmail(email: string) {
        return this.userModel.findOne({email}).lean();
    }

    public async findByPhoneNumber(phoneNumber: string) {
        return !!(await this.userModel.findOne({phoneNumber}));
    }

    public async updateRefreshToken(userId: Types.ObjectId, token: string | null) {
        await this.userModel.findByIdAndUpdate(
            userId,
            {refreshToken: token}
        );
    }

    public async listUser(userId: Types.ObjectId) {
        return this.userModel.find(
            { _id: {$ne: userId}},
            {
                _id: 1,
                name: 1
            }
        ).lean();
    }
}