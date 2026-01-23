// @ts-check
/**
 * @fileoverview Data worker - handles data parsing and processing in a Web Worker.
 * @module workers/data-worker
 */

import { DEFAULT_DESCRIPTIONS } from "../config.js";
import {
  processMapDataCore,
  processRegionDataCore,
} from "../data/itemProcessor.js";

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

/**
 * Processes CSV data for translations.
 * @param {string} csvText - The CSV text content.
 * @returns {{koDict: Object, categoryItemTranslations: Object, parsedCSV: string[][]}}
 */
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

// Worker message handler
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
        // Use shared function from itemProcessor
        result = processRegionDataCore(payload.regionJson, payload.koDict || {});
        break;

      case "PROCESS_MAP_DATA":
        // Use shared function from itemProcessor
        result = processMapDataCore(
          payload.rawItems,
          payload.regionIdMap,
          new Set(payload.missingItems || []),
          payload.categoryItemTranslations || {},
          payload.reverseRegionMap || {},
          DEFAULT_DESCRIPTIONS || {}
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
