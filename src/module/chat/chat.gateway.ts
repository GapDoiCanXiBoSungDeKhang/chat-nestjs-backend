import {
    WebSocketGateway,
    WebSocketServer,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody
} from "@nestjs/websockets";
import {JwtService} from "@nestjs/jwt";

import {Socket, Server} from "socket.io";

@WebSocketGateway({
    cors: {
        origin: "*",
        credentials: true,
    }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly jwtService: JwtService
    ) {}

    // private onlineUsers = new Map<string, Set<string>>();

    handleConnection(client: Socket): any {
        const token: string = client.handshake.auth?.token
            || client.handshake.query?.token;

        if (!token) {
            client.emit("error", {message: "Missing token!"});
            client.disconnect(true);
            return;
        }
        const payload = this.jwtService.verify(token);
        const userId = payload.sub;
        client.data.userId = userId;

        // if (!this.onlineUsers.has(userId)) {
        //     this.onlineUsers.set(userId, new Set());
        //     this.server.emit("user_online", {userId});
        // }
        // this.onlineUsers.get(userId)?.add(client.id);

        console.log(`Client connected: ${client.id}`);
        // console.log(this.onlineUsers);
    }

    handleDisconnect(client: any): any {
        const userId = client.data.userId;
        // this.onlineUsers.delete(userId);
        console.log(`Client disconnected: ${client.id}`);
        // console.log(this.onlineUsers);
    }
}