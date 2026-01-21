// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { refreshSidebarLists } from "../ui.js";
import { markerPool } from "./MarkerPool.js";
import { renderRegionPolygons } from "./regions.js";
import { logger } from "../logger.js";
import {
  createMarkerForItem,
  setRegionPolygonsCache,
} from "./markerFactory.js";
import { webWorkerManager } from "../web-worker-manager.js";

let pixiModule = null;
/**
 * Lazy loads the PixiOverlay module.
 * @returns {Promise<any>} The PixiOverlay module.
 */
/**
 * Lazy loads the PixiOverlay module.
 * @returns {Promise<any>} The PixiOverlay module.
 */
const getPixiModule = async () => {
  if (!pixiModule) {
    pixiModule = await import("./pixiOverlay.js");
  }
  return pixiModule;
};

export {
  showCompletedTooltip,
  hideCompletedTooltip,
} from "./completedTooltip.js";

/**
 * Initializes lazy loading and spatial indexing.
 * @returns {Promise<void>}
 */
/**
 * Initializes lazy loading and spatial indexing.
 * @returns {Promise<void>}
 */
export const initLazyLoading = async () => {
  const items = state.mapData.items;

  if (webWorkerManager.isSupported) {
    const result = await webWorkerManager.buildSpatialIndex(items);
    if (result && result.success) {
      logger.success(
        "LazyLoading",
        `워커 공간 인덱스 생성 완료: ${result.count} items`,
      );
    }
  }

  const filteredRegions = state.regionData;
  const regionPolygonsCache = renderRegionPolygons(filteredRegions);
  setRegionPolygonsCache(regionPolygonsCache);

  state.uniqueRegions.clear();
  items.forEach((item) => {
    const effectiveRegion = item.forceRegion || item.region || "알 수 없음";

    const normalizedRegion =
      state.reverseRegionMap[effectiveRegion] || effectiveRegion;
    state.uniqueRegions.add(normalizedRegion);
  });
};

/**
 * Renders map data and markers.
 * @returns {Promise<void>}
 */
/**
 * Renders map data and markers.
 * @returns {Promise<void>}
 */
export const renderMapDataAndMarkers = async () => {
  const pixi = await getPixiModule();

  if (pixi.isGpuRenderingAvailable()) {
    console.log(
      "%c[Markers] 🚀 GPU 모드로 렌더링 시작...",
      "color: #4CAF50; font-weight: bold;",
    );
    logger.log("Markers", "Rendering with GPU mode (PixiOverlay)");

    if (state.markerClusterGroup) {
      state.markerClusterGroup.clearLayers();
      if (state.map.hasLayer(state.markerClusterGroup)) {
        state.map.removeLayer(state.markerClusterGroup);
      }
    }

    if (state.allMarkers) {
      state.allMarkers.forEach((item) => {
        if (item.marker && state.map.hasLayer(item.marker)) {
          state.map.removeLayer(item.marker);
        }
      });
    }

    markerPool.clearAll();
    state.allMarkers = new Map();
    setState("pendingMarkers", []);
    setState("visibleMarkerIds", new Set());

    await initLazyLoading();

    await pixi.renderMarkersWithPixi(state.mapData.items);

    refreshSidebarLists();
    return;
  } else {
    console.error("WebGL is not available. Cannot render markers.");
    alert("WebGL을 지원하지 않는 브라우저입니다. 지도를 표시할 수 없습니다.");
  }
};
