import {ConflictException, Injectable} from "@nestjs/common";

import {UserService} from "../user/user.service";
import {InputRegisterUserDto} from "./dto/inputRegister.dto";
import {registerDto} from "./dto/register.dto";

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
    ) {}

    async register(dto: InputRegisterUserDto) {
        const existEmail = await this.userService.findByEmail(dto.email);
        const existPhoneNumber = await this.userService.findByPhoneNumber(dto.phoneNumber);
        if (existEmail) {
            throw new ConflictException("Email already exists");
        }
        if (existPhoneNumber) {
            throw new ConflictException("Phone number already exists");
        }
        if (dto.password !== dto.passwordConfirm) {
            throw new ConflictException("Passwords do not match");
        }
        const data: registerDto = {
            password: dto.password,
            phoneNumber: dto.phoneNumber,
            name: `${dto.firstName} ${dto.lastName}`,
            email: dto.email,
        }
        return this.userService.create(data);
    }
}