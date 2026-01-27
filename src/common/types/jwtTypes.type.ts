import {Types} from "mongoose";

export type JwtType = {
    userId: Types.ObjectId;
    name: string;
    email: string;
}