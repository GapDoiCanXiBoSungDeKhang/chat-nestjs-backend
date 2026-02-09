export type CloudUploadType = "image" | "video" | "file" | "voice";

export interface CloudUpload {
    url: string;
    publicId: string;
    thumbnail?: string;
    size: number;
    mimeType: string;
    originalName?: string;
    duration?: number;
}