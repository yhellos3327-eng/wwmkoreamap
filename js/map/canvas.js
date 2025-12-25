import { state, setState } from '../state.js';
import { logger } from '../logger.js';
import { ICON_MAPPING } from '../config.js';

let canvasLayer = null;
let iconCache = new Map();
let loadedIcons = new Set();
const ICON_SIZE = 32;
const DEFAULT_ICON_URL = 'icons/17310010088.png';
let renderedMarkers = new Map();

const preloadIcon = (iconUrl) => {
    return new Promise((resolve) => {
        if (loadedIcons.has(iconUrl)) {
            resolve(true);
            return;
        }

        const img = new Image();
        img.onload = () => {
            loadedIcons.add(iconUrl);
            resolve(true);
        };
        img.onerror = () => {
            resolve(false);
        };
        img.src = iconUrl;
    });
};

const getIconForCategory = (categoryId) => {
    if (iconCache.has(categoryId)) {
        return iconCache.get(categoryId);
    }

    let finalCatId = categoryId;
    if (ICON_MAPPING && ICON_MAPPING.hasOwnProperty(categoryId)) {
        const mapped = ICON_MAPPING[categoryId];
        if (mapped === null) return null;
        finalCatId = mapped;
    }

    let iconUrl = DEFAULT_ICON_URL;
    if (state.mapData && state.mapData.categories) {
        const catObj = state.mapData.categories.find(c => c.id === finalCatId);
        if (catObj && catObj.image) {
            iconUrl = catObj.image;
        }
    }

    const icon = L.icon({
        iconUrl: iconUrl,
        iconSize: [ICON_SIZE, ICON_SIZE],
        iconAnchor: [ICON_SIZE / 2, ICON_SIZE],
        popupAnchor: [0, -ICON_SIZE]
    });

    iconCache.set(categoryId, icon);
    return icon;
};

const getIconUrl = (categoryId) => {
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

export const initCanvasLayer = () => {
    if (typeof L.canvasIconLayer === 'undefined') {
        logger.warn('Canvas', 'L.canvasIconLayer not available');
        return null;
    }

    if (canvasLayer && state.map && state.map.hasLayer(canvasLayer)) {
        return canvasLayer;
    }

    if (canvasLayer && state.map && !state.map.hasLayer(canvasLayer)) {
        canvasLayer.addTo(state.map);
        return canvasLayer;
    }

    canvasLayer = L.canvasIconLayer({});
    setState('canvasLayer', canvasLayer);

    canvasLayer.addOnClickListener((e, data) => {
        if (data && data.length > 0) {
            const marker = data[0];
            if (marker.itemData) {
                showCanvasMarkerPopup(marker, marker.itemData);
            }
        }
    });

    if (state.map) {
        canvasLayer.addTo(state.map);
    }

    if (canvasLayer._canvas) {
        canvasLayer._canvas.style.pointerEvents = 'none';
    }

    logger.success('Canvas', '캔버스 레이어 초기화 완료');
    return canvasLayer;
};

export const renderMarkersOnCanvas = async (items) => {
    if (!canvasLayer) {
        initCanvasLayer();
        if (!canvasLayer) return;
    }
    const currentIds = new Set(items.map(i => i.id));
    const markersToRemove = [];

    for (const [id, marker] of renderedMarkers) {
        if (!currentIds.has(id)) {
            markersToRemove.push(marker);
            renderedMarkers.delete(id);
        }
    }

    if (markersToRemove.length > 0) {
        if (canvasLayer.removeLayers) {
            canvasLayer.removeLayers(markersToRemove);
        } else {
            markersToRemove.forEach(m => canvasLayer.removeMarker(m, false));
        }
    }

    const markersToAdd = [];
    const completedSet = new Set(state.completedList);
    const itemsToAdd = items.filter(item => !renderedMarkers.has(item.id));

    if (itemsToAdd.length > 0) {
        const uniqueIconUrls = new Set();
        itemsToAdd.forEach(item => {
            const iconUrl = getIconUrl(item.category);
            uniqueIconUrls.add(iconUrl);
        });
        [...uniqueIconUrls].forEach(url => preloadIcon(url));
        itemsToAdd.forEach(item => {
            if (!item.x || !item.y) return;
            const lat = parseFloat(item.x);
            const lng = parseFloat(item.y);
            if (isNaN(lat) || isNaN(lng)) return;

            const icon = getIconForCategory(item.category);
            const isCompleted = completedSet.has(item.id);

            const marker = L.marker([lat, lng], {
                icon: icon,
                opacity: isCompleted ? 0.4 : 1.0
            });

            marker.itemData = item;
            markersToAdd.push(marker);
            renderedMarkers.set(item.id, marker);
        });
    }

    if (markersToAdd.length > 0) {
        if (canvasLayer.addLayers) {
            canvasLayer.addLayers(markersToAdd);
        } else {
            markersToAdd.forEach(m => canvasLayer.addMarker(m));
        }
    }
    if (markersToRemove.length > 0 || markersToAdd.length > 0) {
        canvasLayer.redraw();
    }

    if (canvasLayer._canvas) {
        canvasLayer._canvas.style.pointerEvents = 'none';
    }
};

const showCanvasMarkerPopup = (marker, item) => {
    import('./popup.js').then(({ createPopupHtml }) => {
        const latlng = marker.getLatLng();
        const region = item.forceRegion || item.region || "알 수 없음";
        const popupContent = createPopupHtml(item, latlng.lat, latlng.lng, region);

        L.popup()
            .setLatLng(latlng)
            .setContent(popupContent)
            .openOn(state.map);
    });
};

export const clearCanvasLayer = () => {
    if (canvasLayer) {
        const allMarkers = Array.from(renderedMarkers.values());
        if (canvasLayer.removeLayers) {
            canvasLayer.removeLayers(allMarkers);
        } else {
            allMarkers.forEach(m => canvasLayer.removeMarker(m, false));
        }
        canvasLayer.redraw();
        renderedMarkers.clear();

        if (state.map && state.map.hasLayer(canvasLayer)) {
            state.map.removeLayer(canvasLayer);
        }

        logger.log('Canvas', '캔버스 레이어 정리됨');
    }
};

export const isCanvasLayerActive = () => {
    return canvasLayer && state.map.hasLayer(canvasLayer);
};

export const switchToCanvasMode = () => {
    if (state.markerClusterGroup && state.map.hasLayer(state.markerClusterGroup)) {
        state.map.removeLayer(state.markerClusterGroup);
    }

    if (state.allMarkers) {
        state.allMarkers.forEach(item => {
            if (item.marker && state.map.hasLayer(item.marker)) {
                state.map.removeLayer(item.marker);
            }
        });
    }

    initCanvasLayer();
    logger.success('Canvas', '캔버스 모드로 전환 완료');
};

export const switchToNormalMode = () => {
    clearCanvasLayer();
};
