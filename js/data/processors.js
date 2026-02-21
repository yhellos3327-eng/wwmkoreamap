// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { t } from "../utils.js";
import { webWorkerManager } from "../web-worker-manager.js";
import { DEFAULT_DESCRIPTIONS, MAP_CONFIGS } from "../config.js";
import {
  createProcessedItem,
  extractImageList,
  applyItemTranslations,
  createCategories,
  groupItemsByCategory,
  processRegionDataCore,
} from "./itemProcessor.js";

export const USE_WORKERS = true;

/**
 * @typedef {Object} RegionItem
 * @property {number} id
 * @property {string} title
 * @property {number|string} latitude
 * @property {number|string} longitude
 * @property {number} [zoom]
 * @property {number[][]} [coordinates]
 */

/**
 * @typedef {Object} RegionResult
 * @property {RegionItem[]} regionData
 * @property {Object.<number, string>} regionIdMap
 * @property {Object.<string, {lat: number, lng: number, zoom: number}>} regionMetaInfo
 * @property {Object.<string, string>} reverseRegionMap
 * @property {number[][]} boundsCoords
 */

/**
 * @typedef {Object} MapItem
 * @property {number|string} id
 * @property {string} name
 * @property {string} category
 * @property {string} [description]
 * @property {string[]} [images]
 * @property {string|string[]} [video_url]
 * @property {boolean} [isTranslated]
 * @property {string} [forceRegion]
 * @property {number} [regionId]
 * @property {string} [region]
 * @property {string} [originalName]
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {number} [x]
 * @property {number} [y]
 * @property {boolean} [hasCustomPosition]
 * @property {number} [imageSizeW]
 * @property {number} [imageSizeH]
 * @property {boolean} [isBackend]
 * @property {number} [votes]
 * @property {string|number} [user_id]
 * @property {string} [status]
 * @property {MapItem[]} [aggregated]
 * @property {string} [mapId]
 */

/**
 * 지역 데이터를 동기적으로 처리합니다.
 * 공유된 핵심 기능을 사용하지만 t() 번역 지원을 추가합니다.
 * @param {Object} regionJson - 원본 지역 JSON 객체.
 * @returns {RegionResult} 처리된 지역 데이터.
 */
export const processRegionDataSync = (regionJson) => {
  // Use core function with koDict from state
  const result = processRegionDataCore(regionJson, state.koDict || {});

  // Additionally add t() translations for region titles
  const regionData = regionJson.data || [];
  regionData.forEach((region) => {
    const translatedTitle = t(region.title);
    if (translatedTitle && String(translatedTitle) !== region.title) {
      result.reverseRegionMap[String(translatedTitle)] = region.title;
    }
  });

  return result;
};

/**
 * 지역 데이터를 처리하며, 선택적으로 웹 워커를 사용합니다.
 * @param {Object} regionJson - 원본 지역 JSON 객체.
 * @returns {Promise<RegionResult>} 처리된 지역 데이터.
 */
export const processRegionData = async (regionJson) => {
  if (USE_WORKERS && webWorkerManager.isSupported) {
    return webWorkerManager.processRegionData(regionJson, state.koDict);
  }
  return processRegionDataSync(regionJson);
};

/**
 * 아이템에 번역을 적용합니다 (메인 스레드용 t() 지원 포함).
 * @param {MapItem} item - 지도 아이템.
 * @param {Object.<string, string>} reverseRegionMap - 역방향 지역 맵.
 */
const applyTranslationsWithT = (item, reverseRegionMap) => {
  // Use shared function
  applyItemTranslations(
    /** @type {any} */(item),
    state.categoryItemTranslations,
    reverseRegionMap,
    DEFAULT_DESCRIPTIONS
  );

  // Additional: check translated name for default descriptions (t() function)
  if (!item.description || item.description.trim() === "") {
    const translatedName = t(item.name) || item.name;
    if (DEFAULT_DESCRIPTIONS && DEFAULT_DESCRIPTIONS[translatedName]) {
      item.description = DEFAULT_DESCRIPTIONS[translatedName];
    }
  }
};

/**
 * 지도 데이터를 동기적으로 처리합니다.
 * @param {any[]} rawItems - 원본 지도 아이템 배열.
 * @param {Object.<number, string>} regionIdMap - 지역 ID와 이름의 매핑 객체.
 * @param {Set<string>} missingItems - 누락된 아이템 ID 세트.
 * @param {Object.<string, string>} reverseRegionMap - 역방향 지역 조회를 위한 맵.
 * @returns {{mapData: {categories: any[], items: any[]}, itemsByCategory: Object.<string, any[]>}} 처리된 지도 데이터.
 */
export const processMapDataSync = (
  rawItems,
  regionIdMap,
  missingItems,
  reverseRegionMap,
) => {
  const mapData = { categories: [], items: [] };

  // Step 1: Filter and create processed items using shared functions
  mapData.items = rawItems
    .filter((item) => !missingItems.has(`${item.category_id}_${item.id}`))
    .map((item) => {
      const catId = String(item.category_id);
      const regionName = regionIdMap[item.regionId] ?? "알 수 없음";
      const imgList = extractImageList(item);
      return createProcessedItem(item, catId, regionName, imgList);
    });

  // Step 2: Create categories using shared function
  mapData.categories = createCategories(mapData.items);

  // Step 3: Apply translations (with t() support)
  mapData.items.forEach((item) => {
    applyTranslationsWithT(item, reverseRegionMap);
  });

  // Step 4: Group by category using shared function
  const itemsByCategory = groupItemsByCategory(mapData.items);

  return { mapData, itemsByCategory };
};

/**
 * 지도 데이터를 처리하며, 선택적으로 웹 워커를 사용합니다.
 * @param {any[]} rawItems - 원본 지도 아이템 배열.
 * @param {Object.<number, string>} regionIdMap - 지역 ID와 이름의 매핑 객체.
 * @param {Set<string>} missingItems - 누락된 아이템 ID 세트.
 * @param {Object.<string, string>} reverseRegionMap - 역방향 지역 조회를 위한 맵.
 * @returns {Promise<{mapData: {categories: any[], items: any[]}, itemsByCategory: Object.<string, any[]>}>} 처리된 지도 데이터.
 */
export const processMapData = async (
  rawItems,
  regionIdMap,
  missingItems,
  reverseRegionMap,
) => {
  if (USE_WORKERS && webWorkerManager.isSupported) {
    return webWorkerManager.processMapData(
      rawItems,
      regionIdMap,
      missingItems,
      state.categoryItemTranslations,
      reverseRegionMap,
    );
  }
  return processMapDataSync(
    rawItems,
    regionIdMap,
    missingItems,
    reverseRegionMap,
  );
};

/**
 * 응답에서 누락된 아이템을 파싱합니다.
 * @param {Response|{ok: boolean}} missingRes - 응답 객체.
 * @returns {Promise<Set<string>>} 누락된 아이템 ID 세트.
 */
export const parseMissingItems = async (missingRes) => {
  const missingItems = new Set();

  if (missingRes.ok && "text" in missingRes) {
    const missingText = await missingRes.text();
    const lines = missingText.split("\n");
    lines.forEach((line) => {
      const parts = line.split(",");
      if (parts.length >= 2) {
        const catId = parts[0].trim();
        const itemId = parts[1].trim();
        if (catId && itemId && catId !== "CategoryID") {
          missingItems.add(`${catId}_${itemId}`);
        }
      }
    });
  }

  return missingItems;
};

/**
 * Blob에서 JSON 데이터를 파싱하며, 선택적으로 웹 워커를 사용합니다.
 * @param {Blob} dataBlob - 데이터 Blob.
 * @param {Blob} regionBlob - 지역 Blob.
 * @returns {Promise<{dataJson: any, regionJson: any}>} 파싱된 JSON 객체.
 */
export const parseJSONData = async (dataBlob, regionBlob) => {
  if (USE_WORKERS && webWorkerManager.isSupported) {
    const dataText = await dataBlob.text();
    const regionText = await regionBlob.text();

    const [dataJson, regionJson] = await Promise.all([
      webWorkerManager.parseJSON(dataText),
      webWorkerManager.parseJSON(regionText),
    ]);

    return { dataJson, regionJson };
  }

  return {
    dataJson: JSON.parse(await dataBlob.text()),
    regionJson: JSON.parse(await regionBlob.text()),
  };
};

/**
 * 아이템을 카테고리 이름별로 정렬합니다.
 * @param {Object.<string, any[]>} itemsByCategory - 카테고리별로 그룹화된 아이템.
 */
export const sortItemsByCategory = (itemsByCategory) => {
  for (const key in itemsByCategory) {
    itemsByCategory[key].sort((a, b) =>
      String(t(a.name)).localeCompare(String(t(b.name))),
    );
  }
};

/**
 * 지도 데이터에서 고유한 지역을 수집합니다.
 * @param {RegionItem[]} regionData - 지역 데이터.
 * @param {any[]} mapDataItems - 지도 아이템 배열.
 * @param {Object.<string, string>} [reverseRegionMap={}] - 역방향 지역 맵.
 * @returns {Set<string>} 고유한 지역 이름 세트.
 */
export const collectUniqueRegions = (
  regionData,
  mapDataItems,
  reverseRegionMap = {},
) => {
  const regions = new Set();

  regionData.forEach((r) => regions.add(r.title));

  mapDataItems.forEach((i) => {
    const effectiveRegion = i.forceRegion || i.region;
    if (effectiveRegion) {
      const normalizedRegion =
        reverseRegionMap[effectiveRegion] || effectiveRegion;
      regions.add(normalizedRegion);
    }
  });
  return regions;
};

/**
 * CSV 데이터를 지도 아이템으로 파싱합니다.
 * @param {Response|{ok: boolean}} csvRes - CSV 응답 객체.
 * @returns {Promise<any[]>} 파싱된 아이템 배열.
 */
export const parseCSVData = async (csvRes) => {
  if (!csvRes || !csvRes.ok || !("text" in csvRes)) return [];
  const text = await csvRes.text();
  const lines = text.split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headerLine = lines.shift();
  const headers = headerLine.split(",").map((h) => h.trim());

  const items = [];
  lines.forEach((line) => {
    if (!line.trim()) return;
    const parts = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        parts.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    parts.push(current);

    if (parts.length < 6) return;

    const item = {};
    headers.forEach((h, idx) => {
      item[h] = parts[idx]?.trim();
    });
    const regionIdRaw = item.regionId;
    const regionIdNum = parseInt(regionIdRaw);
    const isNumericRegion =
      !isNaN(regionIdNum) && String(regionIdNum) === regionIdRaw;
    let imgList = [];
    let mainImg = "";

    if (item.image) {
      let rawImg = item.image.trim();
      if (rawImg.includes("{id}")) {
        rawImg = rawImg.replace(/{id}/g, item.id);
      }

      if (rawImg.startsWith("[") && rawImg.endsWith("]")) {
        const content = rawImg.slice(1, -1);
        if (content.includes("|")) {
          imgList = content
            .split("|")
            .map((s) => s.trim())
            .filter((s) => s !== "");
        } else {
          try {
            const parsed = JSON.parse(rawImg);
            if (Array.isArray(parsed)) {
              imgList = parsed;
            } else {
              imgList = [content.trim()];
            }
          } catch (e) {
            imgList = [content.trim()];
          }
        }
      } else {
        imgList = [rawImg];
      }

      if (imgList.length > 0) mainImg = imgList[0];
    }

    const processedItem = {
      id: item.id,
      category_id: item.category_id,
      title: item.title,
      description: item.description || "",
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      regionId: isNumericRegion ? regionIdNum : 0,
      image: mainImg,
      video_url: item.video_url || "",
      images: imgList,
      isTranslated: true,
    };

    // Store in global names map for backup/vault inspection
    if (processedItem.id && processedItem.title) {
      state.globalMarkerNames.set(String(processedItem.id), processedItem.title);
      state.globalMarkerNames.set(Number(processedItem.id), processedItem.title);
    }

    if (!isNumericRegion && regionIdRaw) {
      processedItem.forceRegion = regionIdRaw;
    }

    if (!isNaN(processedItem.latitude) && !isNaN(processedItem.longitude)) {
      const config = MAP_CONFIGS[state.currentMapKey];
      const isImageMap = config && config.type === "image";

      const isLargeCoordinate =
        Math.abs(processedItem.latitude) > 10 ||
        Math.abs(processedItem.longitude) > 10;

      if (isImageMap) {
        if (isLargeCoordinate) {
          items.push(processedItem);
        }
      } else {
        if (!isLargeCoordinate) {
          items.push(processedItem);
        }
      }
    }
  });

  return items;
};
