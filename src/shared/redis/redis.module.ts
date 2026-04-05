import {Global, Module} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";

const REDIS_CLIENT = "REDIS_CLIENT"

@Global()
@Module({
    providers: [
        {
            provide: REDIS_CLIENT,
            inject: [ConfigService],
            useFactory: (config: ConfigService): Redis => {
                const client = new Redis({
                    host: config.get<string>("REDIS_HOST", "localhost"),
                    port: config.get<number>("REDIS_PORT", 6379),
                    password: config.get<string>("REDIS_PASSWORD") || undefined,
                    // Tự reconnect khi mất kết nối
                    retryStrategy: (times) => Math.min(times * 100, 3000),
                    lazyConnect: false,
                });
 
                client.on("connect", () => console.log("[Redis] Connected"));
                client.on("error", (err) => console.error("[Redis] Error:", err));
 
                return client;
            },
        },
    ],
    exports: [REDIS_CLIENT]
})
export class RedisModule {};
