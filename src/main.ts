// import dns from "node:dns";

// dns.setServers(['8.8.8.8', '8.8.4.4']);
// dns.setDefaultResultOrder('ipv4first');
import {NestFactory} from "@nestjs/core";
import {ValidationPipe} from "@nestjs/common";

import {AppModule} from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors({
        origin: [process.env.URL_FE_CONNECT],
        credentials: true,
    });

    app.setGlobalPrefix("api");
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        })
    );

    const PORT = process.env.PORT as string;
    await app.listen(PORT);

    console.log(`App listening on port ${PORT}...`);
}

bootstrap();