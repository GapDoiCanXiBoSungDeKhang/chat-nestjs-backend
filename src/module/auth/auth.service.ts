import {ConflictException, Injectable, UnauthorizedException} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import {JwtService} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";
import {randomUUID} from "crypto"

import {UserService} from "../user/user.service";
import {InputRegisterUserDto} from "./dto/inputRegister.dto";
import {registerDto} from "./dto/register.dto";
import {UserDocument} from "../user/schema/user.schema";

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
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

    async validateUser(email: string, password: string) {
        const user = await this.userService.getInfoByEmail(email);
        if (!user) return null;
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return null;
        return user;
    }

    async login(user: UserDocument) {
        const payload = {sub: user._id, name: user.name, email: user.email};

        const accessToken = this.jwtService.sign(payload, {
            expiresIn: "15m"
        });
        const refreshToken = this.jwtService.sign(
            {...payload, jti: randomUUID()},
            {
                secret: this.getConfigSecretRefresh(),
                expiresIn: "7d"
            }
        );

        await this.userService.updateRefreshToken(
            payload.sub,
            refreshToken
        );
        return {
            accessToken,
            refreshToken
        };
    }

    async refresh(refreshToken: string) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.getConfigSecretRefresh(),
            });

            const user = await this.userService.findById(payload.sub);
            if (!user || !user.refreshToken) {
                throw new UnauthorizedException();
            }
            if (refreshToken !== user.refreshToken) {
                throw new UnauthorizedException("Refresh token reused");
            }

            const newPayload = {sub: user._id, name: user.name, email: user.email};
            const newAccessToken = this.jwtService.sign(newPayload, {
                expiresIn: "15m",
            });
            const newRefreshToken = this.jwtService.sign(
                {...newPayload, jti: randomUUID()},
                {
                    secret: this.getConfigSecretRefresh(),
                    expiresIn: "7d",
                }
            );

            await this.userService.updateRefreshToken(
                user._id,
                newRefreshToken
            );
            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            };
        } catch {
            throw new UnauthorizedException("Invalid refresh token");
        }
    }

    getConfigSecretRefresh() {
        return this.configService.get<string>("JWT_SECRET_REFRESH")
    }
}