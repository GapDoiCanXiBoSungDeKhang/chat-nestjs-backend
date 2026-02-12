import {Model} from "mongoose";
import {Injectable} from "@nestjs/common";
import {InjectModel} from "@nestjs/mongoose";
import axios from "axios";
import * as cheerio from "cheerio";
import {LinkPreview, LinkPreviewDocument} from "./schema/link-preview.schema";

@Injectable()
export class LinkPreviewService {
    constructor(
        @InjectModel(LinkPreview.name)
        private readonly linkPreviewModel: Model<LinkPreviewDocument>
    ) {
    }

    public async fetchLink(url: string) {
        const cached = await this.linkPreviewModel.findOne({url}).lean();
        if (cached) return cached;

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
            url,
            title: meta("og:title") || $("title").text(),
            description: meta("og:description"),
            image: meta("og:image"),
        };
        return this.linkPreviewModel.create(preview);
    }
}