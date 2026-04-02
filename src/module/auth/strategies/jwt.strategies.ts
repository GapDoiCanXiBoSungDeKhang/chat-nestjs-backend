import {ExtractJwt, Strategy} from "passport-jwt";
import {PassportStrategy} from "@nestjs/passport";
import {Injectable, UnauthorizedException} from "@nestjs/common";

import {ConfigService} from "@nestjs/config";
import {UserService} from "../../user/user.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private readonly userService: UserService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: configService.get<string>("JWT_SECRET")!,
        });
    }

    // FIX [SECURITY WARNING]: Thêm DB check — trước đây chỉ decode payload, không kiểm tra
    // user còn tồn tại hay không. User bị xoá vẫn dùng được access token còn hạn (15 phút).
    async validate(payload: any) {
        const user = await this.userService.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException("User not found or account has been deleted");
        }
        return {
            userId: payload.sub,
            name: payload.name,
            email: payload.email,
            avatar: payload.avatar,
        }
    }
}