import {Types} from "mongoose";

export const convertStringToObjectId = (text: string) => {
    return new Types.ObjectId(text);
}