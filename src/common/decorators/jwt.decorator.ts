import {createParamDecorator, ExecutionContext} from "@nestjs/common";
import {JwtType} from "../../shared/types/jwtTypes.type";

export const JwtDecode = createParamDecorator(
    (_: unknown, context: ExecutionContext): JwtType => {
        const req = context.switchToHttp().getRequest();
        return req.user;
    }
)