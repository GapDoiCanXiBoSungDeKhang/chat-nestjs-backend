export function extractValidUrls(text: string): string[] {
    const regex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(regex) || [];

    return matches.filter(url => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    });
}
