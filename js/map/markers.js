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

    const items = state.mapData.items;

    // Apply both category AND region filters
    // Build completed ID set once for O(1) lookups
    const completedIdSet = new Set(
      state.completedList.map((c) => String(c.id))
    );

    // Get Boundary Stone ID if needed
    let boundaryStoneId = null;
    if (state.showCommunityMarkers) {
      // Dynamically import to avoid circular dependency issues if possible, or just use re-exported
      // Assuming we import getBoundaryStoneId at top or use logic here
      // For simplicity:
      boundaryStoneId = "17310010083"; // Hardcoded for safety, or imported
    }

    // Combine standard items and community markers if enabled
    let contentItems = items;
    if (state.showCommunityMarkers && state.communityMarkers.size > 0) {
      contentItems = [...items, ...state.communityMarkers.values()];
    }

    let filteredItems = contentItems.filter((item) => {
      // 1. Community Mode Filter
      if (state.showCommunityMarkers) {
        // Show only Backend Markers OR Boundary Stones
        if (item.isBackend) {
          return item.status !== "rejected";
        }
        if (String(item.category) === "17310010083") return true; // Boundary Stone
        return false; // Hide everything else
      } else {
        // Standard Mode: Hide backend markers
        if (item.isBackend) return false;
      }

      // Check category filter
      const catId = item.category;
      if (!state.activeCategoryIds.has(catId)) {
        return false;
      }

      // Check region filter (only if regions are selected)
      if (state.activeRegionNames.size > 0) {
        const rawRegion = item.forceRegion || item.region || "알 수 없음";
        const normalizedRegion = state.reverseRegionMap[rawRegion] || rawRegion;
        if (!state.activeRegionNames.has(normalizedRegion)) {
          return false;
        }
      }

      // Check hideCompleted filter
      if (state.hideCompleted && completedIdSet.has(String(item.id))) {
        return false;
      }

      return true;
    });

    // --- Start Performance & Sampling Optimization ---
    if (state.showCommunityMarkers) {
      const communityList = filteredItems.filter((item) => !!item.isBackend);
      const staticList = filteredItems.filter((item) => !item.isBackend);

      // 1. Spatial Deduplication (Group by Category + Position)
      // Uses a grid based approach to identify markers in the 'same or nearby' location
      const uniqueGrid = new Map();
      const PRECISION = 4; // ~11 meters at current scale, captures 'nearby' duplicates

      const dedupedCommunity = [];
      communityList.forEach((item) => {
        // Key: rounded coords + category
        const key = `${parseFloat(item.lat).toFixed(PRECISION)}_${parseFloat(item.lng).toFixed(PRECISION)}_${item.category}`;

        const existing = uniqueGrid.get(key);
        if (!existing) {
          uniqueGrid.set(key, { ...item, aggregated: [] });
        } else {
          // Rule: Keep higher votes, or if equal, keep latest ID as the master
          const getVoteScore = (v) => {
            if (typeof v === 'number') return v;
            if (v && typeof v === 'object') return (v.up || 0) - (v.down || 0);
            return 0;
          };

          const existingVotes = getVoteScore(existing.votes);
          const currentVotes = getVoteScore(item.votes);

          if (
            currentVotes > existingVotes ||
            (currentVotes === existingVotes &&
              parseInt(item.id) > parseInt(existing.id))
          ) {
            // New is better: promote current to master, move old to aggregated
            const oldMaster = { ...existing };
            delete oldMaster.aggregated; // Prevent nesting

            const newMaster = { ...item, aggregated: [...(existing.aggregated || []), oldMaster] };
            uniqueGrid.set(key, newMaster);
          } else {
            // Existing is better: add current to aggregated
            existing.aggregated = existing.aggregated || [];
            existing.aggregated.push(item);
          }
        }
      });

      const processedCommunity = Array.from(uniqueGrid.values());

      // 2. Redundancy check against Static markers (Optional but good)
      // If a community marker is exactly where a static one is, and same category, skip it.
      const staticKeys = new Set(
        staticList.map(
          (s) =>
            `${parseFloat(s.lat).toFixed(PRECISION)}_${parseFloat(s.lng).toFixed(PRECISION)}_${s.category}`
        )
      );
      const nonRedundantCommunity = processedCommunity.filter((item) => {
        const key = `${parseFloat(item.lat).toFixed(PRECISION)}_${parseFloat(item.lng).toFixed(PRECISION)}_${item.category}`;
        return !staticKeys.has(key);
      });

      // 3. Random Sampling (if over limit)
      const LIMIT = 300;
      let finalCommunity = nonRedundantCommunity;

      if (finalCommunity.length > LIMIT) {
        // Always keep essential items like "Boundary Stones" out of sampling if they were community-made (though they shouldn't be usually)
        // Shuffling
        for (let i = finalCommunity.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalCommunity[i], finalCommunity[j]] = [
            finalCommunity[j],
            finalCommunity[i],
          ];
        }
        finalCommunity = finalCommunity.slice(0, LIMIT);
      }

      // Combine back
      filteredItems = [...staticList, ...finalCommunity];

      if (nonRedundantCommunity.length > LIMIT) {
        console.log(`[Markers] Sampled ${LIMIT} from ${nonRedundantCommunity.length} community markers.`);
      }
    }
    // --- End Performance & Sampling Optimization ---

    setState("lastRenderedItems", filteredItems);

    await pixi.renderMarkersWithPixi(filteredItems);

    refreshSidebarLists();
    return;
  } else {
    console.error("WebGL is not available. Cannot render markers.");
    alert("WebGL을 지원하지 않는 브라우저입니다. 지도를 표시할 수 없습니다.");
  }
};
