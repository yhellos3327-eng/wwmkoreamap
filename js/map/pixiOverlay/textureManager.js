/**
 * Texture Manager Module
 * Handles texture loading and caching for PixiOverlay
 */

import { state } from '../../state.js';
import { logger } from '../../logger.js';
import { ICON_MAPPING } from '../../config.js';
import { DEFAULT_ICON_URL } from './config.js';

// Texture cache
const textureCache = new Map();

/**
 * Get icon URL for a category
 * @param {string} categoryId - The category ID
 * @returns {string|null} - The icon URL or null
 */
export const getIconUrl = (categoryId) => {
    let finalCatId = categoryId;
    if (ICON_MAPPING && ICON_MAPPING.hasOwnProperty(categoryId)) {
        const mapped = ICON_MAPPING[categoryId];
        if (mapped === null) return null;
        finalCatId = mapped;
    }

    if (state.mapData && state.mapData.categories) {
        const catObj = state.mapData.categories.find(c => c.id === finalCatId);
        if (catObj && catObj.image) {
            return catObj.image;
        }
    }
    return DEFAULT_ICON_URL;
};

/**
 * Load a texture asynchronously with caching
 * @param {string} iconUrl - The URL of the icon to load
 * @returns {Promise<PIXI.Texture|null>} - The loaded texture or null
 */
export const loadTexture = async (iconUrl) => {
    if (textureCache.has(iconUrl)) {
        return textureCache.get(iconUrl);
    }

    try {
        const texture = await PIXI.Assets.load(iconUrl);
        textureCache.set(iconUrl, texture);
        return texture;
    } catch (error) {
        logger.warn('TextureManager', `Failed to load texture: ${iconUrl}`);
        // Try loading default icon
        if (iconUrl !== DEFAULT_ICON_URL && !textureCache.has(DEFAULT_ICON_URL)) {
            try {
                const defaultTexture = await PIXI.Assets.load(DEFAULT_ICON_URL);
                textureCache.set(DEFAULT_ICON_URL, defaultTexture);
                return defaultTexture;
            } catch (e) {
                return null;
            }
        }
        return textureCache.get(DEFAULT_ICON_URL) || null;
    }
};

/**
 * Preload all unique textures from items
 * @param {Array} items - Array of map items
 */
export const preloadTextures = async (items) => {
    const uniqueUrls = new Set();

    items.forEach(item => {
        const iconUrl = getIconUrl(item.category);
        if (iconUrl) {
            uniqueUrls.add(iconUrl);
        }
    });

    // Add default icon
    uniqueUrls.add(DEFAULT_ICON_URL);

    const loadPromises = Array.from(uniqueUrls).map(url => loadTexture(url));
    await Promise.all(loadPromises);

    logger.success('TextureManager', `Preloaded ${uniqueUrls.size} textures`);
};

/**
 * Get a cached texture
 * @param {string} url - The texture URL
 * @returns {PIXI.Texture|undefined} - The cached texture
 */
export const getCachedTexture = (url) => {
    return textureCache.get(url);
};

/**
 * Get the default texture
 * @returns {PIXI.Texture|undefined} - The default texture
 */
export const getDefaultTexture = () => {
    return textureCache.get(DEFAULT_ICON_URL);
};

/**
 * Clear all cached textures
 */
export const clearTextureCache = () => {
    textureCache.forEach((texture) => {
        texture.destroy(true);
    });
    textureCache.clear();
};

/**
 * Get texture cache size
 * @returns {number} - Number of cached textures
 */
export const getTextureCacheSize = () => {
    return textureCache.size;
};
