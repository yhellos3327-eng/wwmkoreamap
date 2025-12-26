import { state } from '../../state.js';
import { toggleCompleted } from '../../ui.js';
import { showPopupForSprite } from './spriteFactory.js';
import { showCompletedTooltip, hideCompletedTooltip } from '../completedTooltip.js';
import { updatePixiMarkers } from './overlayCore.js';

let isEventHandlerAttached = false;
let registeredHandlers = {
    click: null,
    contextmenu: null,
    mousemove: null
};

export const calculateHitRadius = (lat, zoom) => {
    const metersPerPixel = 40075016.686 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom + 8);
    const hitRadiusMeters = 22 * metersPerPixel;
    return hitRadiusMeters / 111000;
};

const isPointNearSprite = (clickLat, clickLng, sprite, hitRadiusDeg) => {
    const spriteLat = sprite.markerData.lat;
    const spriteLng = sprite.markerData.lng;

    const dLat = Math.abs(clickLat - spriteLat);
    const dLng = Math.abs(clickLng - spriteLng) * Math.cos(clickLat * Math.PI / 180);

    return dLat <= hitRadiusDeg && dLng <= hitRadiusDeg;
};

export const findSpriteAtPosition = (container, clickLat, clickLng, hitRadiusDeg) => {
    if (!container) return null;
    for (let i = container.children.length - 1; i >= 0; i--) {
        const sprite = container.children[i];
        if (sprite.markerData && isPointNearSprite(clickLat, clickLng, sprite, hitRadiusDeg)) {
            return sprite;
        }
    }
    return null;
};


export const attachEventHandlers = (map, overlay, container) => {
    if (isEventHandlerAttached) {
        console.log('%c[GPU Events] Already attached, skipping', 'color: #FFA500;');
        return;
    }

    const handleClick = (e) => {
        if (!state.gpuRenderMode || !container || container.children.length === 0) return;

        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        const zoom = map.getZoom();
        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

        const sprite = findSpriteAtPosition(container, clickLat, clickLng, hitRadiusDeg);

        if (sprite) {
            hideCompletedTooltip();
            if (e.originalEvent) {
                e.originalEvent.stopPropagation();
            }

            const itemId = sprite.markerData.item.id;
            const currentPopup = map._popup;

            if (currentPopup && currentPopup.itemId === itemId && map.hasLayer(currentPopup)) {
                map.closePopup();
            } else {
                showPopupForSprite(sprite);
            }
        } else {
            map.closePopup();
        }
    };

    const handleContextMenu = (e) => {
        if (!state.gpuRenderMode || !container || container.children.length === 0) return;

        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        const zoom = map.getZoom();
        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

        const sprite = findSpriteAtPosition(container, clickLat, clickLng, hitRadiusDeg);

        if (sprite) {
            if (e.originalEvent) {
                L.DomEvent.preventDefault(e.originalEvent);
                L.DomEvent.stopPropagation(e.originalEvent);
            }

            toggleCompleted(sprite.markerData.item.id);

            setTimeout(() => {
                updatePixiMarkers();
            }, 50);
        }
    };

    const handleMouseMove = (e) => {
        if (!state.gpuRenderMode || !container || container.children.length === 0) {
            hideCompletedTooltip();
            return;
        }

        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        const zoom = map.getZoom();
        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

        for (let i = container.children.length - 1; i >= 0; i--) {
            const sprite = container.children[i];
            if (sprite.markerData &&
                sprite.markerData.isCompleted &&
                isPointNearSprite(clickLat, clickLng, sprite, hitRadiusDeg)) {

                // Check if popup is open for this item
                const currentPopup = map._popup;
                if (currentPopup && currentPopup.itemId === sprite.markerData.item.id && map.hasLayer(currentPopup)) {
                    hideCompletedTooltip();
                    return;
                }

                showCompletedTooltip(
                    { latlng: L.latLng(sprite.markerData.lat, sprite.markerData.lng) },
                    sprite.markerData.item.id,
                    sprite.markerData.item.name,
                    sprite.markerData.completedAt
                );
                return;
            }
        }

        hideCompletedTooltip();
    };

    registeredHandlers.click = handleClick;
    registeredHandlers.contextmenu = handleContextMenu;
    registeredHandlers.mousemove = handleMouseMove;

    map.on('click', handleClick);
    map.on('contextmenu', handleContextMenu);
    map.on('mousemove', handleMouseMove);

    isEventHandlerAttached = true;
    console.log('%c[GPU Events] ✓ Event handlers attached', 'color: #4CAF50;');
};

export const detachEventHandlers = (map) => {
    if (!isEventHandlerAttached || !map) return;

    if (registeredHandlers.click) {
        map.off('click', registeredHandlers.click);
    }
    if (registeredHandlers.contextmenu) {
        map.off('contextmenu', registeredHandlers.contextmenu);
    }
    if (registeredHandlers.mousemove) {
        map.off('mousemove', registeredHandlers.mousemove);
    }

    registeredHandlers = { click: null, contextmenu: null, mousemove: null };
    isEventHandlerAttached = false;

    console.log('%c[GPU Events] ✓ Event handlers detached', 'color: #FFA500;');
};

export const isEventHandlersAttached = () => isEventHandlerAttached;

export const resetEventHandlers = () => {
    isEventHandlerAttached = false;
    registeredHandlers = { click: null, contextmenu: null, mousemove: null };
};
