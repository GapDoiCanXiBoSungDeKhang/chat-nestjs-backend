import {Model, Types} from "mongoose";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import axios from "axios";
import * as cheerio from "cheerio";
import {LinkPreview, LinkPreviewDocument} from "./schema/link-preview.schema";
import {convertStringToObjectId} from "../../shared/helpers/convertObjectId.helpers";

@Injectable()
export class LinkPreviewService {
    constructor(
        @InjectModel(LinkPreview.name)
        private readonly linkPreviewModel: Model<LinkPreviewDocument>
    ) {
    }

    public async fetchLink(
        url: string,
        messageId: string,
        conversationId: string,
        userId: string,
    ) {
        const cached = await this.linkPreviewModel.findOne({url}).lean();
        if (cached) return cached;

        const senderId = convertStringToObjectId(userId);
        const conversationObjectId = convertStringToObjectId(conversationId);
        const messageObjectId = convertStringToObjectId(messageId);

        const {data} = await axios.get(url, {
            timeout: 5000,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ChatBot/1.0)",
            }
        });
        const $ = cheerio.load(data);

        const meta = (prop:string)=>
            $(`meta[property='${prop}']`).attr("content") ||
            $(`meta[name='${prop}']`).attr("content");

        const preview = {
            senderId,
            messageId: messageObjectId,
            conversationId: conversationObjectId,
            url,
            title: meta("og:title") || $("title").text(),
            description: meta("og:description"),
            image: meta("og:image"),
        };
        return this.linkPreviewModel.create(preview);
    }

    public async getLinkPreviews(ids: Types.ObjectId[]) {
        return this.linkPreviewModel.find({messageId: {$in: ids}}).lean();
    }

    public async groupLinkPreviewsById(ids: Types.ObjectId[]) {
        const linkPreviews = await this.getLinkPreviews(ids);

        return linkPreviews.reduce<Record<string, LinkPreviewDocument[]>>(
            (acc, link) => {
                const mgsId = link.messageId.toString();
                if (!acc[mgsId]) acc[mgsId] = [];
                acc[mgsId].push(link);
                return acc;
            }, {});
    }
}