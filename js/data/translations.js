// @ts-check
import { state, setState } from "../state.js";
import { fetchAndParseCSVChunks } from "../utils.js";

/**
 * CSV 파일에서 번역 데이터를 로드합니다.
 * @param {string} mapKey - 맵 키.
 * @returns {Promise<void>}
 */
export const loadTranslations = async (mapKey) => {
  state.koDict = {};
  state.categoryItemTranslations = {};
  state.parsedCSV = [];

  /**
   * CSV 데이터 청크를 처리합니다.
   * @param {string[][]} chunkData - 청크 데이터.
   * @param {string[]} rawHeaders - CSV 헤더.
   */
  const processCSVChunk = (chunkData, rawHeaders) => {
    if (!rawHeaders) return;

    const headers = rawHeaders.map((h) => h.trim());

    if (state.parsedCSV.length === 0) {
      state.parsedCSV.push(headers);
    }
    state.parsedCSV.push(...chunkData);

    const typeIdx = headers.indexOf("Type");
    const catIdx = headers.indexOf("Category");
    const keyIdx = headers.indexOf("Key");
    const valIdx = headers.indexOf("Korean");
    const descIdx = headers.indexOf("Description");
    const regIdx = headers.indexOf("Region");
    const imgIdx = headers.indexOf("Image");
    const videoIdx = headers.indexOf("Video");
    const posIdx = headers.indexOf("CustomPosition");

    if (typeIdx === -1) {
      console.warn(
        'Translation CSV: "Type" header not found. Headers:',
        headers,
      );
    }

    chunkData.forEach((row) => {
      if (row.length < 3) return;

      const type = row[typeIdx]?.trim();
      const key = row[keyIdx]?.trim();
      if (!key) return;

      if (type === "Common") {
        const val = row[valIdx];
        if (val) {
          state.koDict[key] = val;
          state.koDict[key.trim()] = val;
        }
      } else if (type === "Override") {
        processOverrideRow(
          row,
          catIdx,
          keyIdx,
          valIdx,
          descIdx,
          regIdx,
          imgIdx,
          videoIdx,
          posIdx,
        );
      }
    });
  };

  await fetchAndParseCSVChunks("./translation.csv", processCSVChunk);

  if (mapKey === "kaifeng") {
    try {
      await fetchAndParseCSVChunks("./translation2.csv", processCSVChunk);
    } catch (e) {
      console.warn("translation2.csv not found or failed to load", e);
    }
  }
};

/**
 * CSV의 Override 행을 처리합니다.
 * @param {string[]} row - CSV 행.
 * @param {number} catIdx - 카테고리 인덱스.
 * @param {number} keyIdx - 키 인덱스.
 * @param {number} valIdx - 값 인덱스.
 * @param {number} descIdx - 설명 인덱스.
 * @param {number} regIdx - 지역 인덱스.
 * @param {number} imgIdx - 이미지 인덱스.
 * @param {number} videoIdx - 비디오 인덱스.
 * @param {number} posIdx - 커스텀 위치 인덱스.
 */
const processOverrideRow = (
  row,
  catIdx,
  keyIdx,
  valIdx,
  descIdx,
  regIdx,
  imgIdx,
  videoIdx,
  posIdx,
) => {
  const catId = row[catIdx]?.trim();
  const key = row[keyIdx]?.trim();
  if (!catId || !key) return;

  if (!state.categoryItemTranslations[catId]) {
    state.categoryItemTranslations[catId] = {};
  }

  if (key === "_common_description") {
    state.categoryItemTranslations[catId]._common_description = row[descIdx];
    return;
  }

  let desc = row[descIdx];
  if (desc) {
    desc = desc.replace(
      /<hr>/g,
      '<hr style="border: 0; border-bottom: 1px solid var(--border); margin: 10px 0;">',
    );
  }

  const imageData = parseImageField(row[imgIdx], key);
  const videoData = parseVideoField(row[videoIdx]);
  const customPosition = parseCustomPosition(row[posIdx]);

  state.categoryItemTranslations[catId][key] = {
    name: row[valIdx],
    description: desc,
    region: row[regIdx],
    image: imageData,
    video: videoData,
    customPosition: customPosition,
  };
};

/**
 * 이미지 필드를 파싱합니다.
 * @param {string} imageRaw - 원본 이미지 문자열.
 * @param {string} key - 아이템 키.
 * @returns {string|string[]|null} 파싱된 이미지 경로 또는 경로 배열.
 */
const parseImageField = (imageRaw, key) => {
  if (!imageRaw) return null;

  const trimmed = imageRaw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const content = trimmed.slice(1, -1);
    return content
      .split("|")
      .map((v) => {
        let path = v.trim();
        if (path.includes("{id}")) {
          path = path.replace("{id}", key);
        }
        return path;
      })
      .filter((v) => v !== "");
  } else {
    let path = trimmed;
    if (path.includes("{id}")) {
      path = path.replace("{id}", key);
    }
    return path;
  }
};

/**
 * 비디오 필드를 파싱합니다.
 * @param {string} videoUrl - 원본 비디오 URL.
 * @returns {string|string[]|null} 파싱된 비디오 URL 또는 URL 배열.
 */
const parseVideoField = (videoUrl) => {
  if (!videoUrl) return null;

  const trimmed = videoUrl.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const content = trimmed.slice(1, -1);
    return content
      .split("|")
      .map((v) => v.trim())
      .filter((v) => v !== "");
  } else {
    return trimmed;
  }
};

/**
 * @typedef {Object} CustomPosition
 * @property {number} x
 * @property {number} y
 */

/**
 * 커스텀 위치 필드를 파싱합니다.
 * @param {string} positionRaw - 원본 위치 문자열.
 * @returns {CustomPosition|null} 파싱된 위치 객체.
 */
const parseCustomPosition = (positionRaw) => {
  if (!positionRaw) return null;

  const trimmed = positionRaw.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const content = trimmed.slice(1, -1);
    const parts = content.split("|");
    if (parts.length === 2) {
      const x = parseFloat(parts[0].trim());
      const y = parseFloat(parts[1].trim());
      if (!isNaN(x) && !isNaN(y)) {
        return { x, y };
      }
    }
  }
  return null;
};
