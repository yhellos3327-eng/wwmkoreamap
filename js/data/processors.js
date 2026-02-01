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
 */

/**
 * Processes region data synchronously.
 * Uses shared core function but adds t() translation support.
 * @param {Object} regionJson - The raw region JSON object.
 * @returns {RegionResult} The processed region data.
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
 * Processes region data, optionally using a web worker.
 * @param {Object} regionJson - The raw region JSON object.
 * @returns {Promise<RegionResult>} The processed region data.
 */
export const processRegionData = async (regionJson) => {
  if (USE_WORKERS && webWorkerManager.isSupported) {
    return webWorkerManager.processRegionData(regionJson, state.koDict);
  }
  return processRegionDataSync(regionJson);
};

/**
 * Applies translations to an item (with t() support for main thread).
 * @param {MapItem} item - The map item.
 * @param {Object.<string, string>} reverseRegionMap - Reverse region map.
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
 * Processes map data synchronously.
 * @param {any[]} rawItems - Raw map items.
 * @param {Object.<number, string>} regionIdMap - Map of region IDs to names.
 * @param {Set<string>} missingItems - Set of missing item IDs.
 * @param {Object.<string, string>} reverseRegionMap - Map for reverse region lookups.
 * @returns {{mapData: {categories: any[], items: any[]}, itemsByCategory: Object.<string, any[]>}} Processed map data.
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
 * Processes map data, optionally using a web worker.
 * @param {any[]} rawItems - Raw map items.
 * @param {Object.<number, string>} regionIdMap - Map of region IDs to names.
 * @param {Set<string>} missingItems - Set of missing item IDs.
 * @param {Object.<string, string>} reverseRegionMap - Map for reverse region lookups.
 * @returns {Promise<{mapData: {categories: any[], items: any[]}, itemsByCategory: Object.<string, any[]>}>} Processed map data.
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
 * Parses missing items from a response.
 * @param {Response|{ok: boolean}} missingRes - The response object.
 * @returns {Promise<Set<string>>} A set of missing item IDs.
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
 * Parses JSON data from blobs, optionally using a web worker.
 * @param {Blob} dataBlob - The data blob.
 * @param {Blob} regionBlob - The region blob.
 * @returns {Promise<{dataJson: any, regionJson: any}>} The parsed JSON objects.
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
 * Sorts items by category name.
 * @param {Object.<string, any[]>} itemsByCategory - Items grouped by category.
 */
export const sortItemsByCategory = (itemsByCategory) => {
  for (const key in itemsByCategory) {
    itemsByCategory[key].sort((a, b) =>
      String(t(a.name)).localeCompare(String(t(b.name))),
    );
  }
};

/**
 * Collects unique regions from map data.
 * @param {RegionItem[]} regionData - Region data.
 * @param {any[]} mapDataItems - Map items.
 * @param {Object.<string, string>} [reverseRegionMap={}] - Reverse region map.
 * @returns {Set<string>} A set of unique region names.
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
 * Parses CSV data into map items.
 * @param {Response|{ok: boolean}} csvRes - The CSV response.
 * @returns {Promise<any[]>} The parsed items.
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
