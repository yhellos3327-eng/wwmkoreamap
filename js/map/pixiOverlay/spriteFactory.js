/**
 * Sprite Factory Module
 * Creates and manages sprites for map markers
 */

import { state } from '../../state.js';
import { ICON_MAPPING } from '../../config.js';
import { isPointInPolygon } from '../../utils.js';
import { getRegionPolygonsCache } from '../markerFactory.js';
import { createPopupHtml } from '../popup.js';
import { getIconUrl, getCachedTexture, getDefaultTexture } from './textureManager.js';

// Sprite to item data mapping
const spriteDataMap = new Map();

/**
 * Get the sprite data map
 * @returns {Map} - The sprite data map
 */
export const getSpriteDataMap = () => spriteDataMap;

/**
 * Clear the sprite data map
 */
export const clearSpriteDataMap = () => {
    spriteDataMap.clear();
};

/**
 * Show popup for a sprite at its location
 * @param {PIXI.Sprite} sprite - The sprite to show popup for
 */
export const showPopupForSprite = (sprite) => {
    if (!sprite.markerData) return null;

    const { item, lat, lng, region } = sprite.markerData;
    const popupContent = createPopupHtml(item, lat, lng, region);

    const popup = L.popup({
        offset: L.point(0, -22) // Offset to appear above the marker (half of 44px)
    })
        .setLatLng([lat, lng])
        .setContent(popupContent);

    // Store item ID for toggle logic
    popup.itemId = item.id;

    popup.openOn(state.map);
    return popup;
};

/**
 * Create a sprite for an item
 * @param {Object} item - The map item data
 * @returns {PIXI.Sprite|null} - The created sprite or null
 */
export const createSpriteForItem = (item) => {
    let catId = item.category;

    if (typeof ICON_MAPPING !== 'undefined' && ICON_MAPPING.hasOwnProperty(catId)) {
        const mappedValue = ICON_MAPPING[catId];
        if (mappedValue === null) return null;
        catId = mappedValue;
    }

    const lat = parseFloat(item.x);
    const lng = parseFloat(item.y);
    if (isNaN(lat) || isNaN(lng)) return null;

    // Determine region
    let finalRegionName = item.forceRegion || item.region || "알 수 없음";
    const regionPolygonsCache = getRegionPolygonsCache();

    if (!item.forceRegion && regionPolygonsCache.length > 0) {
        for (const polyObj of regionPolygonsCache) {
            if (isPointInPolygon([lat, lng], polyObj.coords)) {
                finalRegionName = polyObj.title;
                item.region = polyObj.title;
                break;
            }
        }
    }

    // Check filter visibility
    const isCatActive = state.activeCategoryIds.has(catId);
    const isRegActive = state.activeRegionNames.has(finalRegionName);
    if (!isCatActive || !isRegActive) return null;

    // Check completed status
    const completedItem = state.completedList.find(c => c.id === item.id);
    const isCompleted = !!completedItem;
    if (state.hideCompleted && isCompleted) return null;

    // Get icon URL
    const iconUrl = getIconUrl(item.category);
    if (!iconUrl) return null;

    const texture = getCachedTexture(iconUrl) || getDefaultTexture();
    if (!texture) return null;

    // Create sprite
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);

    // Set sprite alpha for completed items
    sprite.alpha = isCompleted ? 0.4 : 1.0;

    // Apply grayscale filter for completed items
    if (isCompleted) {
        const colorMatrix = new PIXI.ColorMatrixFilter();
        colorMatrix.desaturate();
        sprite.filters = [colorMatrix];
    }

    // Store item data on sprite for event handling (used by eventHandler.js)
    sprite.markerData = {
        item: item,
        lat: lat,
        lng: lng,
        region: finalRegionName,
        isCompleted: isCompleted,
        completedAt: completedItem?.completedAt
    };

    // Note: PIXI events don't work in leaflet-pixi-overlay 1.8.2
    // Events are handled via Leaflet map events in eventHandler.js

    return sprite;
};

/**
 * Add sprite to data map
 * @param {PIXI.Sprite} sprite - The sprite
 * @param {Object} item - The item data
 */
export const addSpriteToDataMap = (sprite, item) => {
    spriteDataMap.set(sprite, item);
};
