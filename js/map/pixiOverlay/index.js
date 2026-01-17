export { showRenderModeIndicator } from "./renderModeIndicator.js";

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
  getPixiContainer,
} from "./overlayCore.js";

export {
  getIconUrl,
  loadTexture,
  preloadTextures,
  getCachedTexture,
  getDefaultTexture,
  clearTextureCache,
  getTextureCacheSize,
} from "./textureManager.js";

export {
  createSpriteForItem,
  showPopupForSprite,
  getSpriteDataMap,
  clearSpriteDataMap,
} from "./spriteFactory.js";

export { ICON_SIZE, DEFAULT_ICON_URL } from "./config.js";

export {
  attachEventHandlers,
  detachEventHandlers,
  isEventHandlersAttached,
  resetEventHandlers,
  findSpriteAtPosition,
  calculateHitRadius,
} from "./eventHandler.js";
