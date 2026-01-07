export const processCommentText = (text) => {
    if (!text) return text;

    // 스티커를 먼저 추출 (이스케이프 전에)
    const stickers = [];
    let processed = text.replace(/\[sticker:(.*?)\]/g, (match, url) => {
        stickers.push(`<img src="${url}" class="comment-sticker" alt="sticker">`);
        return `[[STICKER_${stickers.length - 1}]]`;
    });

    // HTML 이스케이프 (스티커 플레이스홀더 제외)
    processed = processed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    processed = processed.replace(/~~(.*?)~~/g, '<del>$1</del>');
    processed = processed.replace(/__(.*?)__/g, '<u>$1</u>');
    processed = processed.replace(/\[color:([a-zA-Z0-9#]+)\](.*?)\[\/c\]/g, (match, color, content) => {
        return `<span style="color:${color}">${content}</span>`;
    });

    const allowedDomains = [
        'youtube.com',
        'youtu.be',
        'www.youtube.com',
        'm.youtube.com',
        'wwm.tips',
        'www.wwm.tips',
        window.location.hostname
    ];

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    processed = processed.replace(urlRegex, (url) => {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const isAllowed = allowedDomains.some(domain =>
                hostname === domain || hostname.endsWith('.' + domain)
            );
            if (isAllowed) {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="comment-link">${url}</a>`;
            } else {
                return `<span class="blocked-link" title="허용되지 않은 링크">[링크 차단됨]</span>`;
            }
        } catch (e) {
            return url;
        }
    });

    processed = processed.replace(/\[\[STICKER_(\d+)\]\]/g, (match, index) => {
        return stickers[parseInt(index)];
    });

    return processed;
};
