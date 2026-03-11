export const gatewayRooms = {
    user: (userId: string) => `user:${userId}`,
    conversation: (conversation: string) => `conversation:${conversation}`,
};