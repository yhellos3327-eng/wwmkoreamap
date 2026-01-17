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

export const loadMapData = async (mapKey, onProgress) => {
  const config = MAP_CONFIGS[mapKey];
  if (!config) return;

  try {
    const totalTimer = perfTimer.start("Performance", "loadMapData total");

    await loadTranslations(mapKey);
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

    const uniqueRegions = collectUniqueRegions(
      regionResult.regionData,
      mapData.items,
      regionResult.reverseRegionMap,
    );

    // 지역 메타 정보 보완 (이미지 맵 등에서 지역 파일이 없는 경우)
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

    initializeFiltersFromStorage(mapKey);

    perfTimer.end(totalTimer);

    logger.success(
      "Data",
      `${config.name} 데이터 로드 완료 (${mapData.items.length} items)`,
    );

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
