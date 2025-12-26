export {
    ICON_SIZE,
    DEFAULT_ICON_URL,

    showRenderModeIndicator,

    getIconUrl,
    loadTexture,
    preloadTextures,
    getCachedTexture,
    getDefaultTexture,
    clearTextureCache,
    getTextureCacheSize,

    createSpriteForItem,
    showPopupForSprite,
    getSpriteDataMap,
    clearSpriteDataMap,

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

    attachEventHandlers,
    detachEventHandlers,
    isEventHandlersAttached,
    resetEventHandlers,
    findSpriteAtPosition,
    calculateHitRadius
} from './pixiOverlay/index.js';
