// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { t } from "../utils.js";
import { webWorkerManager } from "../web-worker-manager.js";
import { DEFAULT_DESCRIPTIONS, MAP_CONFIGS } from "../config.js";

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
 */

/**
 * Processes region data synchronously.
 * @param {Object} regionJson - The raw region JSON object.
 * @returns {RegionResult} The processed region data.
 */
export const processRegionDataSync = (regionJson) => {
  const regionData = regionJson.data || [];
  /** @type {Object.<number, string>} */
  const regionIdMap = {};
  /** @type {Object.<string, {lat: number, lng: number, zoom: number}>} */
  const regionMetaInfo = {};
  /** @type {Object.<string, string>} */
  const reverseRegionMap = {};
  const boundsCoords = [];

  regionData.forEach((region) => {
    regionIdMap[region.id] = region.title;
    regionMetaInfo[region.title] = {
      lat: parseFloat(region.latitude),
      lng: parseFloat(region.longitude),
      zoom: region.zoom || 12,
    };

    reverseRegionMap[region.title] = region.title;
    const translatedTitle = t(region.title);
    if (translatedTitle) {
      reverseRegionMap[String(translatedTitle)] = region.title;
    }

    if (region.coordinates && region.coordinates.length > 0) {
      const coords = region.coordinates.map((c) => [
        parseFloat(c[1]),
        parseFloat(c[0]),
      ]);
      boundsCoords.push(...coords);
    }
  });

  return {
    regionData,
    regionIdMap,
    regionMetaInfo,
    reverseRegionMap,
    boundsCoords,
  };
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
 * Applies translations to an item.
 * @param {MapItem} item - The map item.
 * @param {Object.<string, string>} reverseRegionMap - Reverse region map.
 */
const applyTranslations = (item, reverseRegionMap) => {
  const catTrans = state.categoryItemTranslations[item.category];
  let commonDesc = null;

  if (catTrans && catTrans._common_description) {
    commonDesc = catTrans._common_description;
  }

  const categoryDefaultNames = {
    17310010006: "상자 (지상)",
    17310010007: "상자 (지하)",
    17310010012: "곡경심유 (파랑나비)",
    17310010015: "만물의 울림 (노랑나비)",
    17310010090: "야외 제사 (빨간나비)",
  };

  if (categoryDefaultNames[item.category]) {
    item.name = categoryDefaultNames[item.category];
    item.isTranslated = true;
  }

  if (catTrans) {
    let transData = catTrans[item.id];
    if (!transData && item.name) {
      transData = catTrans[item.name];
    }

    if (transData) {
      if (transData.name) {
        item.name = transData.name;
        item.isTranslated = true;
      }
      if (transData.description) {
        item.description = transData.description;
      }
      if (transData.region) {
        item.forceRegion =
          reverseRegionMap[transData.region] || transData.region;
      }
      if (transData.image) {
        item.images = Array.isArray(transData.image)
          ? transData.image
          : [transData.image];
      }
      if (transData.video) {
        item.video_url = transData.video;
      }
      if (transData.customPosition) {
        item.x = transData.customPosition.x;
        item.y = transData.customPosition.y;
        item.hasCustomPosition = true;
      }
    }
  }

  if (!item.description || item.description.trim() === "") {
    const translatedName = t(item.name) || item.name;
    if (DEFAULT_DESCRIPTIONS && DEFAULT_DESCRIPTIONS[translatedName]) {
      item.description = DEFAULT_DESCRIPTIONS[translatedName];
    } else if (DEFAULT_DESCRIPTIONS && DEFAULT_DESCRIPTIONS[item.name]) {
      item.description = DEFAULT_DESCRIPTIONS[item.name];
    } else if (commonDesc) {
      item.description = commonDesc;
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
  /** @type {Object.<string, any[]>} */
  const itemsByCategory = {};

  mapData.items = rawItems
    .filter((item) => !missingItems.has(`${item.category_id}_${item.id}`))
    .map((item) => {
      const catId = String(item.category_id);
      const regionName = regionIdMap[item.regionId] ?? "알 수 없음";

      let imgList = [];
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        imgList = item.images;
      } else if (item.image) {
        imgList = [item.image];
      }

      const processedItem = {
        ...item,
        id: item.id,
        category: catId,
        name: item.title ?? "Unknown",
        description: item.description ?? "",
        x: item.latitude,
        y: item.longitude,
        region: regionName,
        images: imgList,
        imageSizeW: 44,
        imageSizeH: 44,
        isTranslated: item.isTranslated ?? false,
      };

      return processedItem;
    });

  const uniqueCategoryIds = new Set(mapData.items.map((i) => i.category));
  mapData.categories = Array.from(uniqueCategoryIds).map((catId) => ({
    id: catId,
    name: catId,
    image: `./icons/${catId}.png`,
  }));

  mapData.items.forEach((item) => {
    applyTranslations(item, reverseRegionMap);

    if (!itemsByCategory[item.category]) {
      itemsByCategory[item.category] = [];
    }
    itemsByCategory[item.category].push(item);
  });

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
