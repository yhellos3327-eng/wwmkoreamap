import { state } from '../../state.js';
import { logger } from '../../logger.js';
import { ICON_MAPPING } from '../../config.js';
import { DEFAULT_ICON_URL } from './config.js';

const textureCache = new Map();

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

export const preloadTextures = async (items) => {
    const uniqueUrls = new Set();

    items.forEach(item => {
        const iconUrl = getIconUrl(item.category);
        if (iconUrl) {
            uniqueUrls.add(iconUrl);
        }
    });

    uniqueUrls.add(DEFAULT_ICON_URL);

    const loadPromises = Array.from(uniqueUrls).map(url => loadTexture(url));
    await Promise.all(loadPromises);

    logger.success('TextureManager', `Preloaded ${uniqueUrls.size} textures`);
};

export const getCachedTexture = (url) => {
    return textureCache.get(url);
};

export const getDefaultTexture = () => {
    return textureCache.get(DEFAULT_ICON_URL);
};

export const clearTextureCache = () => {
    textureCache.forEach((texture) => {
        texture.destroy(true);
    });
    textureCache.clear();
};

export const getTextureCacheSize = () => {
    return textureCache.size;
};
