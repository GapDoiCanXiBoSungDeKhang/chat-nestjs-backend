import {createParamDecorator, ExecutionContext} from "@nestjs/common";

import {UserDocument} from "../../module/user/schema/user.schema";

export const User = createParamDecorator(
    (_: unknown, context: ExecutionContext): UserDocument => {
        const req = context.switchToHttp().getRequest();
        return req.user;
    }
)