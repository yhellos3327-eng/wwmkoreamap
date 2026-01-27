// @ts-check
/// <reference path="../../types.d.ts" />
const L = /** @type {any} */ (window).L;
const PIXI = /** @type {any} */ (window).PIXI;
const Supercluster = /** @type {any} */ (window).Supercluster;

import { state, setState } from "../../state.js";
import { logger } from "../../logger.js";
import { MAP_CONFIGS } from "../../config.js";
import { ICON_SIZE } from "./config.js";
import {
  preloadTextures,
  clearTextureCache,
  getIconUrl,
  getCachedTexture,
  getDefaultTexture,
} from "./textureManager.js";
import {
  createSpriteForItem,
  clearSpriteDataMap,
  addSpriteToDataMap,
} from "./spriteFactory.js";
import { showRenderModeIndicator } from "./renderModeIndicator.js";
import { attachEventHandlers, detachEventHandlers } from "./eventHandler.js";
import {
  clearSpiderfy,
  getSpiderfiedClusterId,
  getSpiderfyContainer,
  updateSpiderfyPositions,
} from "./spiderfy.js";

let pixiOverlay = null;
let pixiContainer = null;
let isInitialized = false;
let firstDraw = true;
let prevZoom = null;
let supercluster = null;
let pixiUtils = null;

/** @returns {any} The supercluster instance. */
export const getSupercluster = () => supercluster;
/** @returns {any} The PIXI utils. */
export const getPixiUtils = () => pixiUtils;
/** @returns {any} The PIXI container. */
export const getPixiContainer = () => pixiContainer;

/**
 * Checks if GPU rendering is available.
 * @returns {boolean} True if available.
 */
export const isGpuRenderingAvailable = () => {
  const hasPixi =
    typeof PIXI !== "undefined" && typeof L.pixiOverlay !== "undefined";

  let hasWebGL = false;
  try {
    const canvas = document.createElement("canvas");
    hasWebGL = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    hasWebGL = false;
  }

  const available = hasPixi && hasWebGL;
  return available;
};

/** @returns {any} The PIXI overlay instance. */
export const getPixiOverlay = () => pixiOverlay;

/**
 * Initializes the PIXI overlay.
 * @returns {Promise<any>} The PIXI overlay instance.
 */
export const initPixiOverlay = async () => {
  if (!isGpuRenderingAvailable()) {
    logger.warn("PixiOverlay", "PIXI or L.pixiOverlay not available");
    return null;
  }

  if (isInitialized && pixiOverlay) {
    return pixiOverlay;
  }

  pixiContainer = new PIXI.Container();
  pixiContainer.sortableChildren = true;

  pixiOverlay = L.pixiOverlay(
    (utils) => {
      pixiUtils = utils;
      const zoom = utils.getMap().getZoom();
      const container = utils.getContainer();
      const renderer = utils.getRenderer();
      const project = utils.latLngToLayerPoint;
      const scale = utils.getScale();
      const map = utils.getMap();

      if (prevZoom !== null && prevZoom !== zoom) {
        clearSpiderfy();
      } else {
        updateSpiderfyPositions(utils);
      }

      const isSimpleCRS = map.options.crs === L.CRS.Simple;
      if (state.enableClustering && supercluster && !isSimpleCRS) {
        pixiContainer.removeChildren();
        clearSpriteDataMap();

        const bounds = map.getBounds();
        const bbox = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ];

        const padding = 0.1;
        const width = bbox[2] - bbox[0];
        const height = bbox[3] - bbox[1];
        bbox[0] -= width * padding;
        bbox[1] -= height * padding;
        bbox[2] += width * padding;
        bbox[3] += height * padding;

        const clusters = supercluster.getClusters(bbox, Math.floor(zoom));
        const spiderfiedClusterId = getSpiderfiedClusterId();
        const spiderfyContainerRef = getSpiderfyContainer();

        // Safety check: if ID is set but container is missing, treat as not spiderfied
        const isSpiderfyActive =
          spiderfiedClusterId !== null && spiderfyContainerRef !== null;

        clusters.forEach((cluster) => {
          if (isSpiderfyActive && cluster.id === spiderfiedClusterId) {
            return;
          }

          const [lng, lat] = cluster.geometry.coordinates;
          const coords = project([lat, lng]);

          if (cluster.properties.cluster) {
            const count = cluster.properties.point_count;
            const clusterId = cluster.id;

            // Get all items in cluster to check completion status
            const allLeaves = supercluster.getLeaves(clusterId, Infinity);
            const firstItem = allLeaves[0]?.properties?.item;

            // Check if ALL items in cluster are completed
            let allCompleted = allLeaves.length > 0;
            for (const leaf of allLeaves) {
              const item = leaf.properties?.item;
              if (item) {
                const isCompleted = state.completedList.some(
                  (c) => String(c.id) === String(item.id)
                );
                if (!isCompleted) {
                  allCompleted = false;
                  break;
                }
              }
            }

            // Skip if hideCompleted is enabled and all items are completed
            if (state.hideCompleted && allCompleted) {
              return;
            }

            // Create container
            const clusterContainer = new PIXI.Container();
            clusterContainer.x = coords.x;
            clusterContainer.y = coords.y;

            const targetSize = ICON_SIZE / scale;

            // Main marker icon
            let iconUrl = null;
            if (firstItem) {
              iconUrl = getIconUrl(firstItem.category);
            }
            const texture = (iconUrl && getCachedTexture(iconUrl)) || getDefaultTexture();

            if (texture) {
              const sprite = new PIXI.Sprite(texture);
              sprite.anchor.set(0.5, 0.5);
              sprite.width = targetSize;
              sprite.height = targetSize;

              // Apply grayscale filter if all completed (same as individual completed markers)
              if (allCompleted) {
                sprite.alpha = 0.4;
                const colorMatrix = new PIXI.ColorMatrixFilter();
                colorMatrix.desaturate();
                sprite.filters = [colorMatrix];
              }

              clusterContainer.addChild(sprite);

              // Badge - larger and more visible
              const badgeText = count > 99 ? "99+" : count.toString();
              const badgeRadius = Math.max(11, (badgeText.length > 2 ? 14 : 12)) / scale;
              const badgeX = targetSize / 2.2;
              const badgeY = -targetSize / 2.2;

              const badge = new PIXI.Graphics();

              // Outer glow/shadow for visibility
              badge.beginFill(0x000000, 0.4);
              badge.drawCircle(badgeX, badgeY, badgeRadius + 2 / scale);
              badge.endFill();

              // Main badge - gray if all completed, red otherwise
              const badgeColor = allCompleted ? 0x888888 : 0xff3b30;
              badge.beginFill(badgeColor, 1);
              badge.drawCircle(badgeX, badgeY, badgeRadius);
              badge.endFill();

              // White border for contrast
              badge.lineStyle(2 / scale, 0xffffff, 1);
              badge.drawCircle(badgeX, badgeY, badgeRadius);
              clusterContainer.addChild(badge);

              // Badge text - larger font
              const text = new PIXI.Text(badgeText, {
                fontFamily: "Arial",
                fontSize: badgeText.length > 2 ? 10 : 12,
                fill: 0xffffff,
                align: "center",
                fontWeight: "bold",
              });
              text.anchor.set(0.5);
              text.x = badgeX;
              text.y = badgeY;
              text.scale.set(1 / scale);
              clusterContainer.addChild(text);
            }

            clusterContainer.interactive = true;
            clusterContainer.cursor = "pointer";
            clusterContainer.markerData = {
              isCluster: true,
              clusterId: clusterId,
              point_count: count,
              lat: lat,
              lng: lng,
              allCompleted: allCompleted,
            };

            pixiContainer.addChild(clusterContainer);
          } else {
            const item = cluster.properties.item;
            if (item) {
              const sprite = createSpriteForItem(item);
              if (sprite) {
                sprite.x = coords.x;
                sprite.y = coords.y;

                const targetSize = ICON_SIZE / scale;
                sprite.width = targetSize;
                sprite.height = targetSize;

                if (sprite.filters === undefined || sprite.filters === null) {
                  sprite.filters = [];
                }

                pixiContainer.addChild(sprite);
                addSpriteToDataMap(sprite, item);
              }
            }
          }
        });

        const spiderfyContainer = getSpiderfyContainer();
        if (spiderfyContainer) {
          pixiContainer.addChild(spiderfyContainer);
        }
      } else {
        pixiContainer.children.forEach((sprite) => {
          if (sprite.markerData && !sprite.markerData.isCluster) {
            const coords = project([
              sprite.markerData.lat,
              sprite.markerData.lng,
            ]);
            sprite.x = coords.x;
            sprite.y = coords.y;

            const targetSize = ICON_SIZE / scale;
            sprite.width = targetSize;
            sprite.height = targetSize;

            if (sprite.filters === undefined || sprite.filters === null) {
              sprite.filters = [];
            }
          }
        });
      }

      firstDraw = false;
      prevZoom = zoom;
      renderer.render(pixiContainer);
    },
    pixiContainer,
    {
      autoPreventDefault: false,
      doubleBuffering: true,
      destroyInteractionManager: false,
      pane: "markerPane",
    },
  );

  setState("pixiOverlay", pixiOverlay);
  setState("pixiContainer", pixiContainer);
  isInitialized = true;

  console.log(
    "%c╔══════════════════════════════════════════════════════════╗",
    "color: #4CAF50; font-weight: bold;",
  );
  console.log(
    "%c║  🚀 GPU MODE ACTIVATED - PixiOverlay Initialized        ║",
    "color: #4CAF50; font-weight: bold; font-size: 14px;",
  );
  console.log(
    "%c║  Renderer: WebGL (Hardware Accelerated)                  ║",
    "color: #4CAF50;",
  );
  console.log(
    "%c║  PIXI Version: " + (PIXI.VERSION || "unknown").padEnd(41) + " ║",
    "color: #4CAF50;",
  );
  console.log(
    "%c╚══════════════════════════════════════════════════════════╝",
    "color: #4CAF50; font-weight: bold;",
  );

  logger.success("PixiOverlay", "GPU overlay initialized");
  return pixiOverlay;
};

/**
 * Renders markers using PixiJS.
 * @param {any[]} items - The items to render.
 */
export const renderMarkersWithPixi = async (items) => {
  if (!isGpuRenderingAvailable()) {
    logger.warn(
      "PixiOverlay",
      "GPU rendering not available, falling back to CPU mode (setting preserved)",
    );
    return;
  }

  if (!pixiOverlay) {
    await initPixiOverlay();
  }

  if (!pixiOverlay || !pixiContainer) {
    logger.error("PixiOverlay", "Failed to initialize PixiOverlay");
    return;
  }

  await preloadTextures(items);

  if (typeof Supercluster !== "undefined") {
    const config = MAP_CONFIGS[state.currentMapKey];
    const maxZoom = config ? config.maxZoom : 18;

    supercluster = new Supercluster({
      radius: 25, // Reduced: only cluster very close markers
      maxZoom: maxZoom,
      minPoints: 2,
    });

    const points = items.map((item) => ({
      type: "Feature",
      properties: { cluster: false, item: item },
      geometry: {
        type: "Point",
        coordinates: [parseFloat(item.y), parseFloat(item.x)],
      },
    }));

    supercluster.load(points);
    console.log(
      `[PixiOverlay] Supercluster loaded with ${points.length} points`,
    );
  } else {
    console.warn("[PixiOverlay] Supercluster library not found");
  }

  const isSimpleCRS = state.map && state.map.options.crs === L.CRS.Simple;
  if (state.enableClustering && !isSimpleCRS) {
    pixiOverlay.redraw();
  } else {
    pixiContainer.removeChildren();
    clearSpriteDataMap();
    state.allMarkers = new Map();

    let addedCount = 0;
    let skippedCount = 0;
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
          lng: sprite.markerData.lng,
        };
        state.allMarkers.set(item.id, markerInfo);

        addedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(
      `[GPU Render] ${addedCount} markers rendered, ${skippedCount} markers skipped (filtered).`,
    );
    logger.success("PixiOverlay", `Rendered ${addedCount} markers with GPU`);
  }

  if (state.map && !state.map.hasLayer(pixiOverlay)) {
    pixiOverlay.addTo(state.map);

    if (state.map.options) {
      state.map.options.closePopupOnClick = false;
    }

    attachEventHandlers(state.map, pixiOverlay, pixiContainer);
  }

  pixiOverlay.redraw();
  showRenderModeIndicator("GPU");
};

/**
 * Updates PixiJS markers.
 */
export const updatePixiMarkers = async () => {
  if (!isGpuRenderingAvailable()) return;

  const items = state.mapData?.items || [];
  const filteredItems =
    state.activeRegionNames.size > 0
      ? items.filter((item) => {
        const effectiveRegion = item.forceRegion || item.region;
        const normalizedRegion = state.reverseRegionMap[effectiveRegion] || effectiveRegion;
        return state.activeRegionNames.has(normalizedRegion);
      })
      : items;

  await renderMarkersWithPixi(filteredItems);
};

/**
 * Updates a single PixiJS marker's visual state.
 * @param {string|number} itemId - The item ID.
 */
export const updateSinglePixiMarker = (itemId) => {
  if (!pixiContainer) return;

  const sprite = pixiContainer.children.find(
    (s) =>
      s.markerData &&
      s.markerData.item &&
      String(s.markerData.item.id) === String(itemId),
  );

  if (sprite) {
    const completedItem = state.completedList.find(
      (c) => String(c.id) === String(itemId),
    );
    const isCompleted = !!completedItem;

    sprite.alpha = isCompleted ? 0.4 : 1.0;

    if (isCompleted) {
      const colorMatrix = new PIXI.ColorMatrixFilter();
      colorMatrix.desaturate();
      sprite.filters = [colorMatrix];
    } else {
      sprite.filters = [];
    }

    sprite.markerData.isCompleted = isCompleted;
    sprite.markerData.completedAt = completedItem
      ? completedItem.completedAt
      : null;

    if (pixiOverlay) pixiOverlay.redraw();

    logger.log("PixiOverlay", `Updated visual state for marker ${itemId}`);
  }
};

import { memoryManager } from "../../memory.js";

/**
 * Clears the PixiJS overlay.
 */
export const clearPixiOverlay = () => {
  if (pixiContainer) {
    if (memoryManager.debugMode) {
      console.log(
        `[PixiOverlay] Clearing ${pixiContainer.children.length} sprites from container`,
      );
    }

    pixiContainer.removeChildren();
    clearSpriteDataMap();
  }

  if (pixiOverlay && state.map) {
    try {
      if (state.map.hasLayer(pixiOverlay)) {
        state.map.removeLayer(pixiOverlay);
      }
    } catch (e) { }
    detachEventHandlers(state.map);

    if (state.map.options) {
      state.map.options.closePopupOnClick = true;
    }
  }

  logger.log("PixiOverlay", "GPU overlay cleared");
};

/**
 * Checks if the PixiJS overlay is active.
 * @returns {boolean} True if active.
 */
export const isPixiOverlayActive = () => {
  return pixiOverlay && state.map && state.map.hasLayer(pixiOverlay);
};

/**
 * Redraws the PixiJS overlay.
 */
export const redrawPixiOverlay = () => {
  if (pixiOverlay && isPixiOverlayActive()) {
    pixiOverlay.redraw();
  }
};

/**
 * Disposes of the PixiJS overlay and resources.
 */
export const disposePixiOverlay = async () => {
  clearPixiOverlay();

  if (pixiUtils) {
    try {
      const renderer = pixiUtils.getRenderer();
      if (renderer && !renderer.destroyed) {
        renderer.destroy(true);
      }
    } catch (e) {
      console.warn("Failed to destroy PIXI renderer", e);
    }
    pixiUtils = null;
  }

  await clearTextureCache();

  pixiOverlay = null;
  pixiContainer = null;
  supercluster = null;
  isInitialized = false;
  firstDraw = true;
  prevZoom = null;

  setState("pixiOverlay", null);
  setState("pixiContainer", null);

  logger.log("PixiOverlay", "GPU overlay disposed");
};

/**
 * Resets the PixiJS overlay without clearing textures.
 */
export const resetPixiOverlay = () => {
  clearPixiOverlay();

  if (pixiUtils) {
    try {
      const renderer = pixiUtils.getRenderer();
      if (renderer && !renderer.destroyed) {
        renderer.destroy(true);
      }
    } catch (e) {
      console.warn("Failed to destroy PIXI renderer", e);
    }
    pixiUtils = null;
  }

  // Do NOT clear textures
  pixiOverlay = null;
  pixiContainer = null;
  supercluster = null;
  isInitialized = false;
  firstDraw = true;
  prevZoom = null;

  setState("pixiOverlay", null);
  setState("pixiContainer", null);

  logger.log("PixiOverlay", "GPU overlay reset (textures preserved)");
};
