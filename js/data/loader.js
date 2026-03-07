// @ts-check
/// <reference path="../types.d.ts" />
const L = /** @type {any} */ (window).L;
import { MAP_CONFIGS } from "../config.js";
import { state, setState } from "../state.js";
import { fetchWithProgress } from "../utils.js";
import { initMap, renderMapDataAndMarkers } from "../map.js";
import {
  refreshCategoryList,
  updateToggleButtonsState,
  renderFavorites,
} from "../ui.js";
import { calculateTranslationProgress } from "../translation.js";
import { logger, perfTimer } from "../logger.js";
import { loadTranslations } from "./translations.js";
import {
  processRegionData,
  processMapData,
  parseMissingItems,
  parseJSONData,
  sortItemsByCategory,
  collectUniqueRegions,
} from "./processors.js";
import { initializeFiltersFromStorage, saveFilterState } from "./storage.js";
import { resetPixiOverlay } from "../map/pixiOverlay.js";
import { closeModal } from "../ui/modal.js";

/**
 * 특정 맵 키에 해당하는 지도 데이터를 로드합니다.
 * @param {string} mapKey - 맵 키 (예: 'qinghe').
 * @param {function(number, number): void} [onProgress] - 진행률 업데이트를 위한 콜백.
 * @returns {Promise<boolean>} 성공 시 true, 실패 시 false.
 */
export const loadMapData = async (mapKey, onProgress) => {
  const config = MAP_CONFIGS[mapKey];
  if (!config) return false;

  try {
    const totalTimer = perfTimer.start("Performance", "loadMapData total");

    await loadTranslations(mapKey);

    if (state.map) {
      state.map.closePopup();
    }
    closeModal();

    // 새로운 맵을 위해 커뮤니티 마커 초기화
    setState("communityMarkers", new Map());

    // 깜빡임/잔상 방지를 위해 PixiOverlay 초기화
    resetPixiOverlay();

    await initMap(mapKey);

    const { dataBlob, regionBlob, missingRes, newDataRes } = await fetchAllData(
      config,
      onProgress,
    );

    const jsonTimer = perfTimer.start("Worker", "JSON Parsing");
    const { dataJson, regionJson } = await parseJSONData(dataBlob, regionBlob);
    perfTimer.end(jsonTimer);

    const missingItems = await parseMissingItems(missingRes);

    const regionTimer = perfTimer.start("Worker", "Region Data Processing");
    const regionResult = await processRegionData(regionJson);
    perfTimer.end(regionTimer);

    applyRegionData(regionResult, config);

    const mapTimer = perfTimer.start("Worker", "Map Data Processing");
    const rawItems = dataJson.data || [];

    if (newDataRes && newDataRes.ok) {
      const { parseCSVData } = await import("./processors.js");
      const newDataItems = await parseCSVData(newDataRes);
      rawItems.push(...newDataItems);
      logger.log("Data", `신규 마커 로드됨: ${newDataItems.length} items`);
    }

    // [WIKI FEATURE] Fetch approved revisions and override base items
    try {
      const { BACKEND_URL } = await import("../config.js");
      const revRes = await fetch(`${BACKEND_URL}/api/revisions?status=approved`);
      const revData = await revRes.json();

      if (revData.success && revData.revisions && revData.revisions.length > 0) {
        let overriddenCount = 0;

        // Build map for O(1) lookup
        const revisionMap = new Map();
        revData.revisions.forEach(rev => {
          if (!revisionMap.has(rev.target_marker_id)) {
            revisionMap.set(rev.target_marker_id, rev.revision_data);
          }
        });

        // Apply overrides to rawItems
        rawItems.forEach(item => {
          const revOverride = revisionMap.get(String(item.id));
          if (revOverride) {
            if (revOverride.title) item.title = revOverride.title;
            // Handle both name and title mappings to ensure UI picks it up
            if (revOverride.title) item.name = revOverride.title;
            if (revOverride.description) item.description = revOverride.description;
            if (revOverride.screenshot) item.images = [revOverride.screenshot];
            if (revOverride.video) item.video_url = [revOverride.video];
            item.isWikiEdited = true; // Flag for UI hinting
            overriddenCount++;
          }
        });

        logger.success("Wiki", `Applied ${overriddenCount} approved wiki revisions.`);
      }
    } catch (wikiErr) {
      logger.error("Wiki", "Failed to fetch map wiki revisions.", wikiErr);
    }

    const { mapData, itemsByCategory } = await processMapData(
      rawItems,
      regionResult.regionIdMap,
      missingItems,
      regionResult.reverseRegionMap,
    );

    perfTimer.end(mapTimer);

    sortItemsByCategory(itemsByCategory);

    setState("mapData", mapData);
    setState("itemsByCategory", itemsByCategory);

    // 백업/Vault 검사를 위해 모든 마커 이름을 전역적으로 캐시
    if (mapData.items) {
      mapData.items.forEach((item) => {
        const name = item.name || item.title;
        if (name) {
          state.globalMarkerNames.set(String(item.id), name);
          state.globalMarkerNames.set(Number(item.id), name);
        }
      });
    }

    const uniqueRegions = collectUniqueRegions(
      regionResult.regionData,
      mapData.items,
      regionResult.reverseRegionMap,
    );

    const currentMeta = state.regionMetaInfo || {};
    uniqueRegions.forEach((regionName) => {
      if (!currentMeta[regionName]) {
        currentMeta[regionName] = {
          lat: config.center[0],
          lng: config.center[1],
          zoom: config.zoom,
        };
      }
    });

    setState("regionMetaInfo", currentMeta);
    setState("uniqueRegions", uniqueRegions);
    await initializeFiltersFromStorage(mapKey);

    perfTimer.end(totalTimer);

    logger.success(
      "Data",
      `${config.name} 데이터 로드 완료 (${mapData.items.length} items)`,
    );

    if (state.showCommunityMarkers) {
      const { fetchCommunityMarkers, fetchUserCompletions } = await import("../map/community.js");
      await fetchCommunityMarkers();
      await fetchUserCompletions();
    }

    renderMapDataAndMarkers();
    calculateTranslationProgress();
    refreshCategoryList();
    updateToggleButtonsState();
    renderFavorites();

    return true;
  } catch (error) {
    logger.error("Data", "데이터 로드 실패:", error);
    alert(`${config.name} 데이터를 불러오는데 실패했습니다.\n` + error.message);
    return false;
  }
};

const fetchAllData = async (config, onProgress) => {
  const progressState = {
    data: { loaded: 0, total: 0 },
    region: { loaded: 0, total: 0 },
  };

  const updateAggregateProgress = () => {
    if (!onProgress) return;
    const totalLoaded = progressState.data.loaded + progressState.region.loaded;
    const totalSize = progressState.data.total + progressState.region.total;
    if (totalSize > 0) {
      onProgress(totalLoaded, totalSize);
    }
  };

  const dataBlobPromise = config.dataFile
    ? fetchWithProgress(config.dataFile, (loaded, total) => {
      progressState.data.loaded = loaded;
      progressState.data.total = total;
      updateAggregateProgress();
    })
    : Promise.resolve(new Blob(['{"data":[]}'], { type: "application/json" }));

  const regionBlobPromise = config.regionFile
    ? fetchWithProgress(config.regionFile, (loaded, total) => {
      progressState.region.loaded = loaded;
      progressState.region.total = total;
      updateAggregateProgress();
    })
    : Promise.resolve(new Blob(['{"data":[]}'], { type: "application/json" }));

  const missingPromise = fetch("missing_data.csv").catch((e) => ({
    ok: false,
  }));
  const newDataPromise = config.newDataFile
    ? fetch(config.newDataFile).catch((e) => ({ ok: false }))
    : Promise.resolve({ ok: false });

  const [dataBlob, regionBlob, missingRes, newDataRes] = await Promise.all([
    dataBlobPromise,
    regionBlobPromise,
    missingPromise,
    newDataPromise,
  ]);

  return { dataBlob, regionBlob, missingRes, newDataRes };
};

const applyRegionData = (regionResult, config) => {
  const { regionData, regionMetaInfo, boundsCoords, reverseRegionMap } =
    regionResult;

  setState("regionData", regionData);
  setState("regionMetaInfo", regionMetaInfo);
  setState("reverseRegionMap", reverseRegionMap);

  const totalBounds = L.latLngBounds(boundsCoords);

  if (totalBounds.isValid()) {
    state.map.setMaxBounds(totalBounds.pad(0.85));
    state.map.options.minZoom = config.minZoom;

    if (state.currentTileLayer) {
      const padding =
        config.tilePadding !== undefined ? config.tilePadding : 0.1;
      state.currentTileLayer.options.bounds = totalBounds.pad(padding);
      if (typeof state.currentTileLayer.redraw === "function") {
        state.currentTileLayer.redraw();
      }
    }
  }
};

export { saveFilterState } from "./storage.js";
export { loadTranslations } from "./translations.js";
