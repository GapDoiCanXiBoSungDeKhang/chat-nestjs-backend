import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import {Model} from "mongoose";

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

    async findByEmail(email: string) {
        return !!(await this.userModel.findOne({email}));
    }

    async findByPhoneNumber(phoneNumber: string) {
        return !!(await this.userModel.findOne({phoneNumber}));
    }
}