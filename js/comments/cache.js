const commentsCache = new Map();
const CACHE_TTL = 3 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

export const getCachedComments = (itemId) => {
    const cacheKey = `comment_${itemId}`;
    const cached = commentsCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached;
    }
    return null;
};

export const setCachedComments = (itemId, html) => {
    const cacheKey = `comment_${itemId}`;
    commentsCache.set(cacheKey, {
        html,
        timestamp: Date.now()
    });
    trimCache();
};

export const invalidateCache = (itemId) => {
    const cacheKey = `comment_${itemId}`;
    commentsCache.delete(cacheKey);
};

export const clearAllCache = () => {
    commentsCache.clear();
};

const trimCache = () => {
    if (commentsCache.size <= MAX_CACHE_SIZE) return;

    const entries = Array.from(commentsCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, commentsCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => commentsCache.delete(key));
};

export const getCacheStats = () => ({
    size: commentsCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL
});
