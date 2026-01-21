// @ts-check
/**
 * @fileoverview Data worker - handles data parsing and processing in a Web Worker.
 * @module workers/data-worker
 */

import { DEFAULT_DESCRIPTIONS } from "../config.js";

/**
 * Parses a CSV string into a 2D array.
 * @param {string} str - The CSV string.
 * @returns {string[][]} Parsed CSV data.
 */
const parseCSV = (str) => {
  const arr = [];
  let quote = false;
  let col = 0,
    c = 0;

  for (let row = 0; row < str.length; row++) {
    let cc = str[row],
      nc = str[row + 1];

    arr[col] ??= [];
    arr[col][c] ??= "";

    if (cc == '"' && quote && nc == '"') {
      arr[col][c] += cc;
      ++row;
    } else if (cc == "\\" && quote && nc == '"') {
      arr[col][c] += nc;
      ++row;
    } else if (cc == '"') {
      quote = !quote;
    } else if (cc == "," && !quote) {
      ++c;
    } else if (cc == "\r" && nc == "\n" && !quote) {
      ++col;
      c = 0;
      ++row;
    } else if ((cc == "\n" || cc == "\r") && !quote) {
      ++col;
      c = 0;
    } else {
      arr[col][c] += cc;
    }
  }
  return arr;
};

const processJSONData = (
  rawItems,
  regionIdMap,
  blacklistItems,
  categoryItemTranslations,
  reverseRegionMap,
) => {
  const mapData = { categories: [], items: [] };
  const itemsByCategory = {};

  mapData.items = rawItems
    .filter((item) => !blacklistItems.has(`${item.category_id}_${item.id}`))
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
    const catTrans = categoryItemTranslations[item.category];
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
      if (DEFAULT_DESCRIPTIONS && DEFAULT_DESCRIPTIONS[item.name]) {
        item.description = DEFAULT_DESCRIPTIONS[item.name];
      } else if (commonDesc) {
        item.description = commonDesc;
      }
    }

    itemsByCategory[item.category] ??= [];
    itemsByCategory[item.category].push(item);
  });

  return { mapData, itemsByCategory };
};

const processCSVData = (csvText) => {
  const koDict = {};
  const categoryItemTranslations = {};
  const parsedCSV = [];

  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0)
    return { koDict, categoryItemTranslations, parsedCSV };

  const headerLine = lines.shift();
  const headers = parseCSV(headerLine)[0];
  parsedCSV.push(headers);

  const typeIdx = headers.indexOf("Type");
  const catIdx = headers.indexOf("Category");
  const keyIdx = headers.indexOf("Key");
  const valIdx = headers.indexOf("Korean");
  const descIdx = headers.indexOf("Description");
  const regIdx = headers.indexOf("Region");
  const imgIdx = headers.indexOf("Image");
  const videoIdx = headers.indexOf("Video");
  const posIdx = headers.indexOf("CustomPosition");

  lines.forEach((line) => {
    if (!line.trim()) return;

    const parsed = parseCSV(line)[0];
    if (!parsed || parsed.length < 3) return;

    parsedCSV.push(parsed);

    const type = parsed[typeIdx]?.trim();
    const key = parsed[keyIdx]?.trim();
    if (!key) return;

    if (type === "Common") {
      const val = parsed[valIdx];
      if (val) {
        koDict[key] = val;
        koDict[key.trim()] = val;
      }
    } else if (type === "Override") {
      const catId = parsed[catIdx]?.trim();
      if (!catId) return;

      categoryItemTranslations[catId] ??= {};

      if (key === "_common_description") {
        categoryItemTranslations[catId]._common_description = parsed[descIdx];
      } else {
        let desc = parsed[descIdx];
        if (desc) {
          desc = desc.replace(
            /<hr>/g,
            '<hr style="border: 0; border-bottom: 1px solid var(--border); margin: 10px 0;">',
          );
        }

        let imageRaw = imgIdx !== -1 ? parsed[imgIdx] : null;
        let imageData = null;
        if (imageRaw) {
          const trimmed = imageRaw.trim();
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            const content = trimmed.slice(1, -1);
            imageData = content
              .split("|")
              .map((v) => {
                let path = v.trim();
                if (path.includes("{id}")) path = path.replace("{id}", key);
                return path;
              })
              .filter((v) => v !== "");
          } else {
            let path = trimmed;
            if (path.includes("{id}")) path = path.replace("{id}", key);
            imageData = path;
          }
        }

        let videoUrl = videoIdx !== -1 ? parsed[videoIdx] : null;
        let videoData = null;
        if (videoUrl) {
          const trimmed = videoUrl.trim();
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            const content = trimmed.slice(1, -1);
            videoData = content
              .split("|")
              .map((v) => v.trim())
              .filter((v) => v !== "");
          } else {
            videoData = trimmed;
          }
        }

        let customPosition = null;
        const posRaw = posIdx !== -1 ? parsed[posIdx] : null;
        if (posRaw) {
          const trimmedPos = posRaw.trim();
          if (trimmedPos.startsWith("[") && trimmedPos.endsWith("]")) {
            const posContent = trimmedPos.slice(1, -1);
            const posParts = posContent.split("|");
            if (posParts.length === 2) {
              const x = parseFloat(posParts[0].trim());
              const y = parseFloat(posParts[1].trim());
              if (!isNaN(x) && !isNaN(y)) {
                customPosition = { x, y };
              }
            }
          }
        }

        categoryItemTranslations[catId][key] = {
          name: parsed[valIdx],
          description: desc,
          region: parsed[regIdx],
          image: imageData,
          video: videoData,
          customPosition: customPosition,
        };
      }
    }
  });

  return { koDict, categoryItemTranslations, parsedCSV };
};

const processRegionData = (regionJson, koDict) => {
  const regionData = regionJson.data || [];
  const regionIdMap = {};
  const regionMetaInfo = {};
  const reverseRegionMap = {};
  const boundsCoords = [];

  if (regionData && Array.isArray(regionData)) {
    regionData.forEach((region) => {
      regionIdMap[region.id] = region.title;
      regionMetaInfo[region.title] = {
        lat: parseFloat(region.latitude),
        lng: parseFloat(region.longitude),
        zoom: region.zoom ?? 12,
      };

      reverseRegionMap[region.title] = region.title;
      const translatedTitle = koDict[region.title];
      if (translatedTitle) {
        reverseRegionMap[translatedTitle] = region.title;
      }

      if (region.coordinates && region.coordinates.length > 0) {
        const coords = region.coordinates.map((c) => [
          parseFloat(c[1]),
          parseFloat(c[0]),
        ]);
        boundsCoords.push(...coords);
      }
    });
  }

  return {
    regionData,
    regionIdMap,
    regionMetaInfo,
    reverseRegionMap,
    boundsCoords,
  };
};

self.onmessage = function (e) {
  const { type, payload, taskId } = e.data;

  try {
    let result;

    switch (type) {
      case "PARSE_JSON":
        result = JSON.parse(payload.jsonString);
        break;

      case "PROCESS_CSV":
        result = processCSVData(payload.csvText);
        break;

      case "PROCESS_REGION_DATA":
        result = processRegionData(payload.regionJson, payload.koDict || {});
        break;

      case "PROCESS_MAP_DATA":
        result = processJSONData(
          payload.rawItems,
          payload.regionIdMap,
          new Set(payload.missingItems || []),
          payload.categoryItemTranslations || {},
          payload.reverseRegionMap || {},
        );
        break;

      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    self.postMessage({
      taskId,
      success: true,
      result,
    });
  } catch (error) {
    self.postMessage({
      taskId,
      success: false,
      error: error.message,
    });
  }
};
