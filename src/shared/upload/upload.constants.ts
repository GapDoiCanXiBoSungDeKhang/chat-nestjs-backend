export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_FILE_TYPES = {
    media: [
        // Images
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",

        // Videos
        "video/mp4",
        "video/webm",
        "video/quicktime", // .mov (iOS hay dùng)
    ],

    voice: [
        "audio/mpeg", // mp3
        "audio/wav",
        "audio/webm",
        "audio/ogg",
        "audio/mp4", // m4a
    ],

    file: [
        // PDF
        "application/pdf",

        // Word
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

        // Excel
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        // PowerPoint
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",

        // Text
        "text/plain",
    ],
};
