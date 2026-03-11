import {AuthGuard} from "@nestjs/passport";
import {ExecutionContext, Injectable} from "@nestjs/common";
import {plainToInstance} from "class-transformer";
import {validateOrReject} from "class-validator";

import {LoginDto} from "../dto/login.dto";

@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const dto = plainToInstance(LoginDto, req.body);
        await validateOrReject(dto);

        return super.canActivate(context) as boolean;
    }
}