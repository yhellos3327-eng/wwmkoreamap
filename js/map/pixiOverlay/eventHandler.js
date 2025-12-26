/**
 * Event Handler Module
 * Handles click/touch events for PixiOverlay sprites using Leaflet events
 */

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

/**
 * Calculate hit radius in degrees based on zoom level
 */
export const calculateHitRadius = (lat, zoom) => {
    const metersPerPixel = 40075016.686 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom + 8);
    const hitRadiusMeters = 22 * metersPerPixel; // ICON_SIZE / 2
    return hitRadiusMeters / 111000; // Convert to degrees
};

/**
 * Check if a point is within hit radius of a sprite
 */
const isPointNearSprite = (clickLat, clickLng, sprite, hitRadiusDeg) => {
    const spriteLat = sprite.markerData.lat;
    const spriteLng = sprite.markerData.lng;

    const dLat = Math.abs(clickLat - spriteLat);
    const dLng = Math.abs(clickLng - spriteLng) * Math.cos(clickLat * Math.PI / 180);

    return dLat <= hitRadiusDeg && dLng <= hitRadiusDeg;
};

/**
 * Find sprite at given position
 */
export const findSpriteAtPosition = (container, clickLat, clickLng, hitRadiusDeg) => {
    if (!container) return null;

    // Iterate in reverse to check top sprites first
    for (let i = container.children.length - 1; i >= 0; i--) {
        const sprite = container.children[i];
        if (sprite.markerData && isPointNearSprite(clickLat, clickLng, sprite, hitRadiusDeg)) {
            return sprite;
        }
    }
    return null;
};

/**
 * Attach event handlers to the map for PixiOverlay interaction
 */
export const attachEventHandlers = (map, overlay, container) => {
    // Prevent double attachment
    if (isEventHandlerAttached) {
        console.log('%c[GPU Events] Already attached, skipping', 'color: #FFA500;');
        return;
    }

    // Click handler
    const handleClick = (e) => {
        if (!state.gpuRenderMode || !container || container.children.length === 0) return;

        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        const zoom = map.getZoom();
        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

        const sprite = findSpriteAtPosition(container, clickLat, clickLng, hitRadiusDeg);

        if (sprite) {
            // Stop the event from propagating further
            if (e.originalEvent) {
                e.originalEvent.stopPropagation();
                e.originalEvent.preventDefault();
            }

            // Toggle logic: Close if already open for this item
            const itemId = sprite.markerData.item.id;
            const currentPopup = map._popup; // Access internal Leaflet property for current popup

            if (currentPopup && currentPopup.itemId === itemId && map.hasLayer(currentPopup)) {
                map.closePopup();
            } else {
                showPopupForSprite(sprite);
            }
        }
    };

    // Right-click (context menu) handler
    const handleContextMenu = (e) => {
        if (!state.gpuRenderMode || !container || container.children.length === 0) return;

        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        const zoom = map.getZoom();
        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

        const sprite = findSpriteAtPosition(container, clickLat, clickLng, hitRadiusDeg);

        if (sprite) {
            // Stop the event
            if (e.originalEvent) {
                e.originalEvent.stopPropagation();
                e.originalEvent.preventDefault();
            }
            L.DomEvent.preventDefault(e);
            L.DomEvent.stop(e);

            // Toggle completed
            toggleCompleted(sprite.markerData.item.id);

            // Re-render to update visual state
            setTimeout(() => {
                updatePixiMarkers();
            }, 50);
        }
    };

    // Mouse move handler for tooltips
    const handleMouseMove = (e) => {
        if (!state.gpuRenderMode || !container || container.children.length === 0) {
            hideCompletedTooltip();
            return;
        }

        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        const zoom = map.getZoom();
        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

        // Find hovered completed sprite
        for (let i = container.children.length - 1; i >= 0; i--) {
            const sprite = container.children[i];
            if (sprite.markerData &&
                sprite.markerData.isCompleted &&
                sprite.markerData.completedAt &&
                isPointNearSprite(clickLat, clickLng, sprite, hitRadiusDeg)) {

                showCompletedTooltip(
                    { originalEvent: e.originalEvent },
                    sprite.markerData.item.id,
                    sprite.markerData.item.name,
                    sprite.markerData.completedAt
                );
                return;
            }
        }

        hideCompletedTooltip();
    };

    // Store references for cleanup
    registeredHandlers.click = handleClick;
    registeredHandlers.contextmenu = handleContextMenu;
    registeredHandlers.mousemove = handleMouseMove;

    // Attach events
    map.on('click', handleClick);
    map.on('contextmenu', handleContextMenu);
    map.on('mousemove', handleMouseMove);

    isEventHandlerAttached = true;
    console.log('%c[GPU Events] ✓ Event handlers attached', 'color: #4CAF50;');
};

/**
 * Detach event handlers from the map
 */
export const detachEventHandlers = (map) => {
    if (!isEventHandlerAttached || !map) return;

    // Remove registered handlers
    if (registeredHandlers.click) {
        map.off('click', registeredHandlers.click);
    }
    if (registeredHandlers.contextmenu) {
        map.off('contextmenu', registeredHandlers.contextmenu);
    }
    if (registeredHandlers.mousemove) {
        map.off('mousemove', registeredHandlers.mousemove);
    }

    // Reset
    registeredHandlers = { click: null, contextmenu: null, mousemove: null };
    isEventHandlerAttached = false;

    console.log('%c[GPU Events] ✓ Event handlers detached', 'color: #FFA500;');
};

/**
 * Check if event handlers are attached
 */
export const isEventHandlersAttached = () => isEventHandlerAttached;

/**
 * Reset event handler state (for mode switching)
 */
export const resetEventHandlers = () => {
    isEventHandlerAttached = false;
    registeredHandlers = { click: null, contextmenu: null, mousemove: null };
};
