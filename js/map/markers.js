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
 * PixiOverlay 모듈을 지연 로드(Lazy load)합니다.
 * @returns {Promise<any>} PixiOverlay 모듈.
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
 * 지연 로딩과 공간 인덱싱을 초기화합니다.
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
 * 지도 데이터와 마커를 렌더링합니다.
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

    const completedIdSet = new Set(
      state.completedList.map((c) => String(c.id))
    );

    let boundaryStoneId = null;
    if (state.showCommunityMarkers) {
      boundaryStoneId = "17310010083";
    }

    let contentItems = items;
    if (state.showCommunityMarkers && state.communityMarkers.size > 0) {
      contentItems = [...items, ...state.communityMarkers.values()];
    }

    let filteredItems = contentItems.filter((item) => {
      if (state.questGuideOpen && state.currentQuestLineId) {
        if (state.activeQuestMarkerIds.has(String(item.id))) {
          return true;
        }
        return false;
      }

      if (state.showCommunityMarkers) {
        if (item.isBackend) {
          return item.status !== "rejected";
        }
        if (String(item.category) === "17310010083") return true;
        return false;
      } else {
        if (item.isBackend) return false;
      }

      const catId = item.category;
      if (!state.activeCategoryIds.has(catId)) {
        return false;
      }

      if (state.activeRegionNames.size > 0) {
        const rawRegion = item.forceRegion || item.region || "알 수 없음";
        const normalizedRegion = state.reverseRegionMap[rawRegion] || rawRegion;
        if (!state.activeRegionNames.has(normalizedRegion)) {
          return false;
        }
      }

      if (state.hideCompleted && completedIdSet.has(String(item.id))) {
        return false;
      }

      return true;
    });

    // --- Start Performance & Sampling Optimization ---
    if (state.showCommunityMarkers) {
      const communityList = filteredItems.filter((item) => !!item.isBackend);
      const staticList = filteredItems.filter((item) => !item.isBackend);

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
            const oldMaster = { ...existing };
            delete oldMaster.aggregated;

            const newMaster = { ...item, aggregated: [...(existing.aggregated || []), oldMaster] };
            uniqueGrid.set(key, newMaster);
          } else {
            existing.aggregated = existing.aggregated || [];
            existing.aggregated.push(item);
          }
        }
      });

      const processedCommunity = Array.from(uniqueGrid.values());

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

      const LIMIT = 300;
      let finalCommunity = nonRedundantCommunity;

      if (finalCommunity.length > LIMIT) {
        for (let i = finalCommunity.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalCommunity[i], finalCommunity[j]] = [
            finalCommunity[j],
            finalCommunity[i],
          ];
        }
        finalCommunity = finalCommunity.slice(0, LIMIT);
      }

      filteredItems = [...staticList, ...finalCommunity];
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
