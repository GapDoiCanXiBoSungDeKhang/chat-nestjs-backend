import * as bcrypt from "bcrypt";

export const hashToken = async (token: string) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(token, salt);
}