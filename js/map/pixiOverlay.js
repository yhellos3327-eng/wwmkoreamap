/**
 * PixiOverlay GPU Rendering Module
 * Uses WebGL via Pixi.js for high-performance marker rendering
 * 
 * @deprecated This file is kept for backward compatibility.
 * Import from './pixiOverlay/index.js' for new code.
 */

// Re-export everything from the modular structure
export {
    // Config
    ICON_SIZE,
    DEFAULT_ICON_URL,

    // Render Mode Indicator
    showRenderModeIndicator,

    // Texture Manager
    getIconUrl,
    loadTexture,
    preloadTextures,
    getCachedTexture,
    getDefaultTexture,
    clearTextureCache,
    getTextureCacheSize,

    // Sprite Factory
    createSpriteForItem,
    showPopupForSprite,
    getSpriteDataMap,
    clearSpriteDataMap,

    // Overlay Core
    isGpuRenderingAvailable,
    initPixiOverlay,
    renderMarkersWithPixi,
    updatePixiMarkers,
    clearPixiOverlay,
    isPixiOverlayActive,
    redrawPixiOverlay,
    disposePixiOverlay,
    getPixiOverlay,
    getPixiContainer,

    // Event Handler
    attachEventHandlers,
    detachEventHandlers,
    isEventHandlersAttached,
    resetEventHandlers,
    findSpriteAtPosition,
    calculateHitRadius
} from './pixiOverlay/index.js';
