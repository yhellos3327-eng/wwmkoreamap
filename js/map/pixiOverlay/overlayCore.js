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

/** @returns {any} 슈퍼클러스터 인스턴스. */
export const getSupercluster = () => supercluster;
/** @returns {any} PIXI 유틸리티. */
export const getPixiUtils = () => pixiUtils;
/** @returns {any} PIXI 컨테이너. */
export const getPixiContainer = () => pixiContainer;

/**
 * GPU 렌더링을 사용할 수 있는지 확인합니다.
 * @returns {boolean} 사용 가능하면 true.
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

/** @returns {any} PIXI 오버레이 인스턴스. */
export const getPixiOverlay = () => pixiOverlay;

/**
 * PIXI 오버레이를 초기화합니다.
 * @returns {Promise<any>} PIXI 오버레이 인스턴스.
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

        const isSpiderfyActive =
          spiderfiedClusterId !== null && spiderfyContainerRef !== null;

        const completedIdSet = new Set(
          state.completedList.map((c) => String(c.id))
        );

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

            let visibleCount = 0;
            let allVisibleCompleted = true;
            let hasAnyVisibleItem = false;
            let firstVisibleItem = null;

            for (const leaf of allLeaves) {
              const item = leaf.properties?.item;
              if (!item) continue;

              let catId = item.category;
              let isCatActive = state.activeCategoryIds.has(catId);

              const effectiveRegion = item.forceRegion || item.region || "알 수 없음";
              const normalizedRegion =
                state.reverseRegionMap[effectiveRegion] || effectiveRegion;
              let isRegActive = state.activeRegionNames.has(normalizedRegion);

              if (state.showCommunityMarkers && item.isBackend) {
                if (item.status === "rejected") continue;
                isCatActive = true;
                isRegActive = true;
              }

              if (!isCatActive || !isRegActive) continue;

              hasAnyVisibleItem = true;

              if (!firstVisibleItem) {
                firstVisibleItem = item;
              }

              const isCompleted = completedIdSet.has(String(item.id));

              if (state.hideCompleted && isCompleted) continue;

              visibleCount++;
              if (!isCompleted) {
                allVisibleCompleted = false;
              }
            }

            if (!hasAnyVisibleItem || visibleCount === 0) {
              return;
            }

            const allCompleted = allVisibleCompleted && visibleCount > 0;

            const clusterContainer = new PIXI.Container();
            clusterContainer.x = coords.x;
            clusterContainer.y = coords.y;

            const targetSize = ICON_SIZE / scale;

            let iconUrl = null;
            if (firstVisibleItem) {
              iconUrl = getIconUrl(firstVisibleItem.category);
            }
            const texture = (iconUrl && getCachedTexture(iconUrl)) || getDefaultTexture();

            if (texture) {
              const sprite = new PIXI.Sprite(texture);
              sprite.anchor.set(0.5, 0.5);
              sprite.width = targetSize;
              sprite.height = targetSize;

              if (allCompleted) {
                sprite.alpha = 0.4;
                const colorMatrix = new PIXI.ColorMatrixFilter();
                colorMatrix.desaturate();
                sprite.filters = [colorMatrix];
              }

              clusterContainer.addChild(sprite);

              const badgeText = visibleCount > 99 ? "99+" : visibleCount.toString();
              const badgeRadius = Math.max(11, (badgeText.length > 2 ? 14 : 12)) / scale;
              const badgeX = targetSize / 2.2;
              const badgeY = -targetSize / 2.2;

              const badge = new PIXI.Graphics();

              badge.beginFill(0x000000, 0.4);
              badge.drawCircle(badgeX, badgeY, badgeRadius + 2 / scale);
              badge.endFill();

              // Main badge - gray if all completed, red otherwise
              const badgeColor = allCompleted ? 0x888888 : 0xff3b30;
              badge.beginFill(badgeColor, 1);
              badge.drawCircle(badgeX, badgeY, badgeRadius);
              badge.endFill();

              badge.lineStyle(2 / scale, 0xffffff, 1);
              badge.drawCircle(badgeX, badgeY, badgeRadius);
              clusterContainer.addChild(badge);

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
              point_count: visibleCount,
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
 * PixiJS를 사용하여 마커를 렌더링합니다.
 * @param {any[]} items - 렌더링할 아이템 배열.
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
      radius: 25,
      maxZoom: maxZoom,
      minPoints: 2,
    });

    const points = items.map((item) => ({
      type: "Feature",
      properties: { cluster: false, item: item },
      geometry: {
        type: "Point",
        coordinates: [
          parseFloat(item.lng ?? item.y),
          parseFloat(item.lat ?? item.x),
        ],
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

    attachEventHandlers(state.map, pixiOverlay, pixiContainer);
  }

  pixiOverlay.redraw();
  showRenderModeIndicator("GPU");
};

/**
 * 중앙 집중식 렌더링 로직을 사용하여 PixiJS 마커를 업데이트합니다.
 */
export const updatePixiMarkers = async () => {
  if (!isGpuRenderingAvailable()) return;

  // Use the centralized rendering logic from markers.js to ensure all
  // filters and community mode state are respected.
  const { renderMapDataAndMarkers } = await import("../markers.js");
  await renderMapDataAndMarkers();
};

/**
 * 단일 PixiJS 마커의 시각적 상태를 업데이트합니다.
 * @param {string|number} itemId - 아이템 ID.
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
 * PixiJS 오버레이를 지웁니다.
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
 * PixiJS 오버레이가 활성화되어 있는지 확인합니다.
 * @returns {boolean} 활성화되어 있으면 true.
 */
export const isPixiOverlayActive = () => {
  return pixiOverlay && state.map && state.map.hasLayer(pixiOverlay);
};

/**
 * PixiJS 오버레이를 다시 그립니다.
 */
export const redrawPixiOverlay = () => {
  if (pixiOverlay && isPixiOverlayActive()) {
    pixiOverlay.redraw();
  }
};

/**
 * PixiJS 오버레이와 리소스를 해제합니다.
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
 * 텍스처를 지우지 않고 PixiJS 오버레이를 초기화합니다.
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
