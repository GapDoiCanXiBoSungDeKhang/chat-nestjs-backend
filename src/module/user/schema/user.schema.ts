import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import * as bcrypt from "bcrypt";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email!: string;

    @Prop({ required: true })
    password!: string;

    @Prop({ required: true })
    phoneNumber!: string;

    @Prop({ required: true })
    name!: string;

    @Prop({ default: null })
    avatar?: string;

    @Prop({ default: "offline" })
    status!: "online" | "offline";

    @Prop({ default: false })
    isOnline!: boolean;

    @Prop({ default: null })
    lastSeen!: Date;

    @Prop({ default: null })
    refreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre<UserDocument>("save", async function () {
    if (!this.isModified("password")) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.set("toJSON", {
    transform: (_, ret: any) => {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.phoneNumber;
        return ret;
    },
});

UserSchema.index({ email: 1 });
UserSchema.index({ isOnline: 1 });

