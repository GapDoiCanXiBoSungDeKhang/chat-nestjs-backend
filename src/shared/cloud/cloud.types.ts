export type CloudUploadType = "media" | "file" | "voice";

export type UploadFileType = "file" | "video" | "voice" | "image";

export interface CloudUpload {
    url: string;
    publicId: string;
    thumbnail?: string;
    size: number;
    mimeType: string;
    originalName?: string;
    duration?: number;
}