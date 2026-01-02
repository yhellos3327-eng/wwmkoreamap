import { state, setState } from '../../state.js';
import { logger } from '../../logger.js';
import { ICON_SIZE } from './config.js';
import { preloadTextures, clearTextureCache } from './textureManager.js';
import { createSpriteForItem, clearSpriteDataMap, addSpriteToDataMap } from './spriteFactory.js';
import { showRenderModeIndicator } from './renderModeIndicator.js';
import { attachEventHandlers, detachEventHandlers } from './eventHandler.js';

let pixiOverlay = null;
let pixiContainer = null;
let isInitialized = false;
let firstDraw = true;
let prevZoom = null;

export const isGpuRenderingAvailable = () => {
    const hasPixi = typeof window.PIXI !== 'undefined' && typeof L.pixiOverlay !== 'undefined';

    // Check WebGL support
    let hasWebGL = false;
    try {
        const canvas = document.createElement('canvas');
        hasWebGL = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
        hasWebGL = false;
    }

    const available = hasPixi && hasWebGL;

    // Only log if status changes or on first check (optional, but keeping it simple)
    // console.log('%c[GPU Check] PIXI: ' + hasPixi + ', WebGL: ' + hasWebGL,
    //    'color: ' + (available ? '#4CAF50' : '#f44336') + '; font-weight: bold;');

    return available;
};

export const getPixiOverlay = () => pixiOverlay;

export const getPixiContainer = () => pixiContainer;

export const initPixiOverlay = async () => {
    if (!isGpuRenderingAvailable()) {
        logger.warn('PixiOverlay', 'PIXI or L.pixiOverlay not available');
        return null;
    }

    if (isInitialized && pixiOverlay) {
        return pixiOverlay;
    }

    pixiContainer = new PIXI.Container();
    pixiContainer.sortableChildren = true;

    pixiOverlay = L.pixiOverlay((utils) => {
        const zoom = utils.getMap().getZoom();
        const renderer = utils.getRenderer();
        const project = utils.latLngToLayerPoint;
        const scale = utils.getScale();

        pixiContainer.children.forEach(sprite => {
            if (sprite.markerData) {
                const coords = project([sprite.markerData.lat, sprite.markerData.lng]);
                sprite.x = coords.x;
                sprite.y = coords.y;

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
        pane: 'markerPane'
    });

    setState('pixiOverlay', pixiOverlay);
    setState('pixiContainer', pixiContainer);
    isInitialized = true;

    console.log('%c╔══════════════════════════════════════════════════════════╗', 'color: #4CAF50; font-weight: bold;');
    console.log('%c║  🚀 GPU MODE ACTIVATED - PixiOverlay Initialized        ║', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
    console.log('%c║  Renderer: WebGL (Hardware Accelerated)                  ║', 'color: #4CAF50;');
    console.log('%c║  PIXI Version: ' + (PIXI.VERSION || 'unknown').padEnd(41) + ' ║', 'color: #4CAF50;');
    console.log('%c╚══════════════════════════════════════════════════════════╝', 'color: #4CAF50; font-weight: bold;');

    logger.success('PixiOverlay', 'GPU overlay initialized');
    return pixiOverlay;
};

export const renderMarkersWithPixi = async (items) => {
    if (!isGpuRenderingAvailable()) {
        logger.warn('PixiOverlay', 'GPU rendering not available, falling back to CPU mode');
        setState('gpuRenderMode', false);
        return;
    }

    if (!pixiOverlay) {
        await initPixiOverlay();
    }

    if (!pixiOverlay || !pixiContainer) {
        logger.error('PixiOverlay', 'Failed to initialize PixiOverlay');
        return;
    }

    await preloadTextures(items);

    pixiContainer.removeChildren();
    clearSpriteDataMap();
    state.allMarkers = new Map();

    let addedCount = 0;
    for (const item of items) {
        const sprite = createSpriteForItem(item);
        if (sprite) {
            pixiContainer.addChild(sprite);
            addSpriteToDataMap(sprite, item);

            const markerInfo = {
                id: item.id,
                sprite: sprite,
                name: item.name,
                category: item.category,
                region: sprite.markerData.region,
                lat: sprite.markerData.lat,
                lng: sprite.markerData.lng
            };
            state.allMarkers.set(item.id, markerInfo);

            addedCount++;
        }
    }

    if (state.map && !state.map.hasLayer(pixiOverlay)) {
        pixiOverlay.addTo(state.map);

        if (state.map.options) {
            state.map.options.closePopupOnClick = false;
        }

        attachEventHandlers(state.map, pixiOverlay, pixiContainer);
    }

    pixiOverlay.redraw();

    showRenderModeIndicator('GPU');

    console.log('%c[GPU Render] ✓ ' + addedCount + ' markers rendered with WebGL', 'color: #4CAF50; font-weight: bold; font-size: 12px;');
    logger.success('PixiOverlay', `Rendered ${addedCount} markers with GPU`);
};

export const updatePixiMarkers = async () => {
    if (!state.gpuRenderMode || !isGpuRenderingAvailable()) return;

    const items = state.mapData?.items || [];
    await renderMarkersWithPixi(items);
};

export const updateSinglePixiMarker = (itemId) => {
    if (!state.gpuRenderMode || !pixiContainer) return;

    const sprite = pixiContainer.children.find(s => s.markerData && s.markerData.item.id === itemId);

    if (sprite) {
        const completedItem = state.completedList.find(c => c.id === itemId);
        const isCompleted = !!completedItem;

        sprite.alpha = isCompleted ? 0.4 : 1.0;

        if (isCompleted) {
            const colorMatrix = new PIXI.ColorMatrixFilter();
            colorMatrix.desaturate();
            sprite.filters = [colorMatrix];
        } else {
            sprite.filters = null;
        }

        sprite.markerData.isCompleted = isCompleted;
        sprite.markerData.completedAt = completedItem ? completedItem.completedAt : null;

        if (pixiOverlay) pixiOverlay.redraw();

        logger.log('PixiOverlay', `Updated visual state for marker ${itemId}`);
    }
};

export const clearPixiOverlay = () => {
    if (pixiContainer) {
        pixiContainer.removeChildren();
        clearSpriteDataMap();
    }

    if (pixiOverlay && state.map) {
        try {
            if (state.map.hasLayer(pixiOverlay)) {
                state.map.removeLayer(pixiOverlay);
            }
        } catch (e) {
        }
        detachEventHandlers(state.map);

        if (state.map.options) {
            state.map.options.closePopupOnClick = true;
        }
    }

    logger.log('PixiOverlay', 'GPU overlay cleared');
};

export const isPixiOverlayActive = () => {
    return pixiOverlay && state.map && state.map.hasLayer(pixiOverlay);
};

export const redrawPixiOverlay = () => {
    if (pixiOverlay && isPixiOverlayActive()) {
        pixiOverlay.redraw();
    }
};

export const disposePixiOverlay = () => {
    clearPixiOverlay();

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
