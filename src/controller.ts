import {Get, Controller} from "@nestjs/common";

@Controller()
export class appController {
    @Get()
    sayHello() {
        return "Hello World!";
    }
}