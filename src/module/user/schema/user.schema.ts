import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {Document} from "mongoose";
import * as bcrypt from "bcrypt";

export type UserDocument = User & Document;

export class PrivacySettings {
    lastSeenVisibility: "everyone" | "friends" | "nobody" = "everyone";
    showReadReceipts: boolean = true;
    showTypingIndicator: boolean = true;
}

@Schema({timestamps: true})
export class User {
    @Prop({required: true, unique: true, lowercase: true, trim: true})
    email!: string;

    @Prop({required: true})
    password!: string;

    @Prop({required: true})
    phoneNumber!: string;

    @Prop({required: true})
    name!: string;

    @Prop({default: null})
    avatar?: string;

    @Prop({
        type: String,
        enum: ["online", "offline", "away", "busy"],
        default: "offline"
    })
    status!: "online" | "offline" | "away" | "busy";

    @Prop({ type: String, default: null })
    customStatusMessage?: string | null;

    @Prop({default: null})
    lastSeen!: Date;

    @Prop({
        lastSeenVisibility: {
            type: String,
            enum: ["everyone", "friends", "nobody"],
            default: "everyone"
        },
        showReadReceipts: {type: Boolean, default: true},
        showTypingIndicator: {type: Boolean, default: true},
    })
    privacy!: {
        lastSeenVisibility: "everyone" | "friends" | "nobody",
        showReadReceipts: boolean,
        showTypingIndicator: boolean,
    }

    @Prop({default: null})
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

UserSchema.index({email: 1}, {unique: true});
UserSchema.index({phone: 1}, {unique: true});

