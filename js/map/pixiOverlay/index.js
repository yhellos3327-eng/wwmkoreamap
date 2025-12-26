/**
 * PixiOverlay GPU Rendering Module
 * Uses WebGL via Pixi.js for high-performance marker rendering
 * 
 * This is the main entry point that re-exports all public APIs
 */

// Re-export from renderModeIndicator
export { showRenderModeIndicator } from './renderModeIndicator.js';

// Re-export from overlayCore
export {
    isGpuRenderingAvailable,
    initPixiOverlay,
    renderMarkersWithPixi,
    updatePixiMarkers,
    clearPixiOverlay,
    isPixiOverlayActive,
    redrawPixiOverlay,
    disposePixiOverlay,
    getPixiOverlay,
    getPixiContainer
} from './overlayCore.js';

// Re-export from textureManager (for external usage if needed)
export {
    getIconUrl,
    loadTexture,
    preloadTextures,
    getCachedTexture,
    getDefaultTexture,
    clearTextureCache,
    getTextureCacheSize
} from './textureManager.js';

// Re-export from spriteFactory (for external usage if needed)
export {
    createSpriteForItem,
    showPopupForSprite,
    getSpriteDataMap,
    clearSpriteDataMap
} from './spriteFactory.js';

// Re-export config
export { ICON_SIZE, DEFAULT_ICON_URL } from './config.js';

// Re-export from eventHandler
export {
    attachEventHandlers,
    detachEventHandlers,
    isEventHandlersAttached,
    resetEventHandlers,
    findSpriteAtPosition,
    calculateHitRadius
} from './eventHandler.js';
