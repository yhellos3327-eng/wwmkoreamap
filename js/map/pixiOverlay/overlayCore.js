/**
 * Overlay Core Module
 * Core PixiOverlay initialization and management
 */

import { state, setState } from '../../state.js';
import { logger } from '../../logger.js';
import { ICON_SIZE } from './config.js';
import { preloadTextures, clearTextureCache } from './textureManager.js';
import { createSpriteForItem, clearSpriteDataMap, addSpriteToDataMap } from './spriteFactory.js';
import { showRenderModeIndicator } from './renderModeIndicator.js';
import { attachEventHandlers, detachEventHandlers } from './eventHandler.js';

// Module state
let pixiOverlay = null;
let pixiContainer = null;
let isInitialized = false;
let firstDraw = true;
let prevZoom = null;

/**
 * Check if GPU rendering is available
 * @returns {boolean} - True if GPU rendering is available
 */
export const isGpuRenderingAvailable = () => {
    const available = typeof window.PIXI !== 'undefined' && typeof L.pixiOverlay !== 'undefined';
    console.log('%c[GPU Check] PIXI: ' + (typeof window.PIXI !== 'undefined') + ', L.pixiOverlay: ' + (typeof L.pixiOverlay !== 'undefined'),
        'color: ' + (available ? '#4CAF50' : '#f44336') + '; font-weight: bold;');
    return available;
};

/**
 * Get the PixiOverlay instance
 * @returns {L.PixiOverlay|null} - The overlay instance
 */
export const getPixiOverlay = () => pixiOverlay;

/**
 * Get the PIXI container
 * @returns {PIXI.Container|null} - The PIXI container
 */
export const getPixiContainer = () => pixiContainer;

/**
 * Initialize the PixiOverlay layer
 * @returns {Promise<L.PixiOverlay|null>} - The initialized overlay or null
 */
export const initPixiOverlay = async () => {
    if (!isGpuRenderingAvailable()) {
        logger.warn('PixiOverlay', 'PIXI or L.pixiOverlay not available');
        return null;
    }

    if (isInitialized && pixiOverlay) {
        return pixiOverlay;
    }

    // Create container
    pixiContainer = new PIXI.Container();
    pixiContainer.sortableChildren = true;

    // Create overlay with draw function
    pixiOverlay = L.pixiOverlay((utils) => {
        const zoom = utils.getMap().getZoom();
        const renderer = utils.getRenderer();
        const project = utils.latLngToLayerPoint;
        const scale = utils.getScale();

        // Update all sprite positions and scales
        pixiContainer.children.forEach(sprite => {
            if (sprite.markerData) {
                const coords = project([sprite.markerData.lat, sprite.markerData.lng]);
                sprite.x = coords.x;
                sprite.y = coords.y;

                // Scale sprites to maintain constant size
                const targetSize = ICON_SIZE / scale;
                sprite.width = targetSize;
                sprite.height = targetSize;
            }
        });

        firstDraw = false;
        prevZoom = zoom;
        renderer.render(pixiContainer);
    }, pixiContainer, {
        autoPreventDefault: false,
        doubleBuffering: true,
        destroyInteractionManager: false,
        // Render on markerPane to be above overlayPane (where polygons are)
        // Render on markerPane to be above overlayPane (where polygons are)
        pane: 'markerPane'
    });

    // Force pointer-events: none on the canvas is handled by css/gpu-mode.css

    setState('pixiOverlay', pixiOverlay);
    setState('pixiContainer', pixiContainer);
    isInitialized = true;

    // Log WebGL renderer info
    console.log('%c╔══════════════════════════════════════════════════════════╗', 'color: #4CAF50; font-weight: bold;');
    console.log('%c║  🚀 GPU MODE ACTIVATED - PixiOverlay Initialized        ║', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
    console.log('%c║  Renderer: WebGL (Hardware Accelerated)                  ║', 'color: #4CAF50;');
    console.log('%c║  PIXI Version: ' + (PIXI.VERSION || 'unknown').padEnd(41) + ' ║', 'color: #4CAF50;');
    console.log('%c╚══════════════════════════════════════════════════════════╝', 'color: #4CAF50; font-weight: bold;');

    logger.success('PixiOverlay', 'GPU overlay initialized');
    return pixiOverlay;
};

/**
 * Render markers using PixiOverlay
 * @param {Array} items - Array of map items to render
 */
export const renderMarkersWithPixi = async (items) => {
    if (!isGpuRenderingAvailable()) {
        logger.warn('PixiOverlay', 'GPU rendering not available, falling back to CPU mode');
        setState('gpuRenderMode', false);
        return;
    }

    // Initialize overlay if needed
    if (!pixiOverlay) {
        await initPixiOverlay();
    }

    if (!pixiOverlay || !pixiContainer) {
        logger.error('PixiOverlay', 'Failed to initialize PixiOverlay');
        return;
    }

    // Preload textures
    await preloadTextures(items);

    // Clear existing sprites
    pixiContainer.removeChildren();
    clearSpriteDataMap();

    // Create sprites for all visible items
    let addedCount = 0;
    for (const item of items) {
        const sprite = createSpriteForItem(item);
        if (sprite) {
            pixiContainer.addChild(sprite);
            addSpriteToDataMap(sprite, item);
            addedCount++;
        }
    }

    // Add overlay to map if not already added
    if (state.map && !state.map.hasLayer(pixiOverlay)) {
        pixiOverlay.addTo(state.map);

        // Attach event handlers for click/contextmenu
        attachEventHandlers(state.map, pixiOverlay, pixiContainer);
    }

    // Trigger redraw
    pixiOverlay.redraw();

    // Show rendering mode indicator
    showRenderModeIndicator('GPU');

    console.log('%c[GPU Render] ✓ ' + addedCount + ' markers rendered with WebGL', 'color: #4CAF50; font-weight: bold; font-size: 12px;');
    logger.success('PixiOverlay', `Rendered ${addedCount} markers with GPU`);
};

/**
 * Update markers (for filter changes)
 */
export const updatePixiMarkers = async () => {
    if (!state.gpuRenderMode || !isGpuRenderingAvailable()) return;

    const items = state.mapData?.items || [];
    await renderMarkersWithPixi(items);
};

/**
 * Clear all sprites from the overlay
 */
export const clearPixiOverlay = () => {
    if (pixiContainer) {
        pixiContainer.removeChildren();
        clearSpriteDataMap();
    }

    if (pixiOverlay && state.map && state.map.hasLayer(pixiOverlay)) {
        state.map.removeLayer(pixiOverlay);
        detachEventHandlers(state.map);
    }

    logger.log('PixiOverlay', 'GPU overlay cleared');
};

/**
 * Check if GPU overlay is currently active
 * @returns {boolean} - True if overlay is active
 */
export const isPixiOverlayActive = () => {
    return pixiOverlay && state.map && state.map.hasLayer(pixiOverlay);
};

/**
 * Redraw the overlay (call after zoom/pan)
 */
export const redrawPixiOverlay = () => {
    if (pixiOverlay && isPixiOverlayActive()) {
        pixiOverlay.redraw();
    }
};

/**
 * Dispose all resources
 */
export const disposePixiOverlay = () => {
    clearPixiOverlay();

    // Clear texture cache
    clearTextureCache();

    pixiOverlay = null;
    pixiContainer = null;
    isInitialized = false;
    firstDraw = true;
    prevZoom = null;

    setState('pixiOverlay', null);
    setState('pixiContainer', null);

    logger.log('PixiOverlay', 'GPU overlay disposed');
};
