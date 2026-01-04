import { state } from '../../state.js';
import { ICON_MAPPING } from '../../config.js';
import { isPointInPolygon } from '../../utils.js';
import { getRegionPolygonsCache } from '../markerFactory.js';
import { createPopupHtml } from '../popup.js';
import { getIconUrl, getCachedTexture, getDefaultTexture } from './textureManager.js';
import { loadComments } from '../../comments.js';

const spriteDataMap = new Map();

export const getSpriteDataMap = () => spriteDataMap;

export const clearSpriteDataMap = () => {
    spriteDataMap.clear();
};

export const showPopupForSprite = (sprite) => {
    if (!sprite.markerData) return null;

    const { item, lat, lng, region } = sprite.markerData;
    const popupContent = createPopupHtml(item, lat, lng, region);

    const popup = L.popup({
        offset: L.point(0, -22)
    })
        .setLatLng([lat, lng])
        .setContent(popupContent);

    popup.itemId = item.id;

    popup.openOn(state.map);

    if (loadComments) {
        loadComments(item.id);
    }

    return popup;
};

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

    let finalRegionName = item.forceRegion || item.region || "알 수 없음";

    finalRegionName = state.reverseRegionMap[finalRegionName] || finalRegionName;

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

    const isCatActive = state.activeCategoryIds.has(catId);
    const isRegActive = state.activeRegionNames.has(finalRegionName);
    if (!isCatActive || !isRegActive) return null;

    const completedItem = state.completedList.find(c => c.id === item.id);
    const isCompleted = !!completedItem;
    if (state.hideCompleted && isCompleted) return null;

    const iconUrl = getIconUrl(item.category);
    if (!iconUrl) return null;

    const texture = getCachedTexture(iconUrl) || getDefaultTexture();
    if (!texture) return null;

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);

    sprite.alpha = isCompleted ? 0.4 : 1.0;

    if (isCompleted) {
        const colorMatrix = new PIXI.ColorMatrixFilter();
        colorMatrix.desaturate();
        sprite.filters = [colorMatrix];
    }

    sprite.markerData = {
        item: item,
        lat: lat,
        lng: lng,
        region: finalRegionName,
        isCompleted: isCompleted,
        completedAt: completedItem?.completedAt
    };

    return sprite;
};

export const addSpriteToDataMap = (sprite, item) => {
    spriteDataMap.set(sprite, item);
};
