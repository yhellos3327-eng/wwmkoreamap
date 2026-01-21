// @ts-check

/**
 * @typedef {Object} CachedComment
 * @property {string} html - The cached HTML.
 * @property {number} timestamp - The cache timestamp.
 */

/** @type {Map<string, CachedComment>} */
const commentsCache = new Map();

/** @type {number} */
const CACHE_TTL = 3 * 60 * 1000;

/** @type {number} */
const MAX_CACHE_SIZE = 50;

/**
 * Gets cached comments for an item.
 * @param {number|string} itemId - The item ID.
 * @returns {CachedComment|null} The cached data or null.
 */
export const getCachedComments = (itemId) => {
  const cacheKey = `comment_${itemId}`;
  const cached = commentsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  return null;
};

/**
 * Sets cached comments for an item.
 * @param {number|string} itemId - The item ID.
 * @param {string} html - The HTML to cache.
 */
export const setCachedComments = (itemId, html) => {
  const cacheKey = `comment_${itemId}`;
  commentsCache.set(cacheKey, {
    html,
    timestamp: Date.now(),
  });
  trimCache();
};

/**
 * Invalidates cache for a specific item.
 * @param {number|string} itemId - The item ID.
 */
export const invalidateCache = (itemId) => {
  const cacheKey = `comment_${itemId}`;
  commentsCache.delete(cacheKey);
};

/**
 * Clears all cached comments.
 */
export const clearAllCache = () => {
  commentsCache.clear();
};

/**
 * Trims the cache to stay within size limits.
 */
const trimCache = () => {
  if (commentsCache.size <= MAX_CACHE_SIZE) return;

  const entries = Array.from(commentsCache.entries()).sort(
    (a, b) => a[1].timestamp - b[1].timestamp,
  );

  const toRemove = entries.slice(0, commentsCache.size - MAX_CACHE_SIZE);
  toRemove.forEach(([key]) => commentsCache.delete(key));
};

/**
 * Gets cache statistics.
 * @returns {{size: number, maxSize: number, ttl: number}} Cache stats.
 */
export const getCacheStats = () => ({
  size: commentsCache.size,
  maxSize: MAX_CACHE_SIZE,
  ttl: CACHE_TTL,
});
