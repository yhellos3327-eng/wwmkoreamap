// @ts-check

/**
 * @typedef {Object} DataLoadOptions
 * @property {boolean} [force] - Force reload even if cached.
 * @property {Function} [onLog] - Logging callback function.
 */

/**
 * @typedef {Object} LoadedData
 * @property {Set<string>} allMarkerIds - All marker IDs.
 * @property {Set<string>} allRegionNames - All region names.
 */

/** @type {LoadedData|null} */
let cachedData = null;

/**
 * 따옴표가 포함된 값을 처리하여 CSV 라인을 파싱합니다.
 * @param {string} line - CSV 라인.
 * @returns {string[]} 파싱된 데이터 배열.
 */
const parseCSVLine = (line) => {
  const parts = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      parts.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim().replace(/^"|"$/g, ""));

  return parts;
};

/**
 * JSON 및 CSV 파일에서 모든 데이터를 로드합니다.
 * @param {DataLoadOptions} [options] - 로드 옵션.
 * @returns {Promise<LoadedData>} 로드된 데이터.
 */
export const loadAllData = async (options = {}) => {
  if (cachedData && !options.force) {
    return cachedData;
  }

  const allMarkerIds = new Set();
  const allRegionNames = new Set();

  const log = options.onLog || (() => { });

  log("> 전체 데이터 파일 로드 중...", "info");

  try {
    await loadJSONMarkers(allMarkerIds, log);
    await loadCSVMarkers(allMarkerIds, allRegionNames, log);
    await loadRegionJSON(allRegionNames, log);
    await loadTranslationCSV(allRegionNames, log);

    allRegionNames.add("알 수 없음");

    log(
      `> 데이터 로드 완료: 마커 ${allMarkerIds.size}개, 지역 ${allRegionNames.size}개`,
      "success",
    );

    cachedData = { allMarkerIds, allRegionNames };
    return cachedData;
  } catch (error) {
    console.error("Error loading data:", error);
    return { allMarkerIds: new Set(), allRegionNames: new Set() };
  }
};

/**
 * JSON 파일에서 마커를 로드합니다.
 * @param {Set<string>} markerIds - 마커 ID를 추가할 Set.
 * @param {Function} log - 로그 출력 함수.
 */
const loadJSONMarkers = async (markerIds, log) => {
  const files = ["./data.json", "./data2.json"];

  for (const file of files) {
    try {
      const res = await fetch(file);
      if (!res.ok) continue;

      const json = await res.json();
      let count = 0;

      if (json.data && Array.isArray(json.data)) {
        json.data.forEach((item) => {
          if (item.id) {
            markerIds.add(String(item.id));
            count++;
          }
        });
      }

      log(`  - ${file}: 마커 ${count}개 로드`, "info");
    } catch (e) {
      console.warn(`Failed to load ${file}:`, e);
    }
  }
};

/**
 * CSV 파일에서 마커를 로드합니다.
 * @param {Set<string>} markerIds - 마커 ID를 추가할 Set.
 * @param {Set<string>} regionNames - 지역명을 추가할 Set.
 * @param {Function} log - 로그 출력 함수.
 */
const loadCSVMarkers = async (markerIds, regionNames, log) => {
  const files = ["./data3.csv", "./data4.csv"];

  for (const file of files) {
    try {
      const res = await fetch(file);
      if (!res.ok) continue;

      const text = await res.text();
      const lines = text.split("\n");
      let markerCount = 0;
      let regionCount = 0;

      const headers = lines[0]
        ? lines[0].split(",").map((h) => h.trim().toLowerCase())
        : [];
      const regionIdIndex = headers.findIndex((h) => h === "regionid");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",");
        if (parts.length > 0 && parts[0]) {
          const id = parts[0].trim();
          if (/^\d+$/.test(id)) {
            markerIds.add(id);
            markerCount++;
          }

          if (regionIdIndex !== -1 && parts[regionIdIndex]) {
            const regionName = parts[regionIdIndex].trim();
            if (regionName && !regionNames.has(regionName)) {
              regionNames.add(regionName);
              regionCount++;
            }
          }
        }
      }

      log(
        `  - ${file}: 마커 ${markerCount}개, 지역 ${regionCount}개 로드`,
        "info",
      );
    } catch (e) {
      console.warn(`Failed to load ${file}:`, e);
    }
  }
};

/**
 * JSON 파일에서 지역 데이터를 로드합니다.
 * @param {Set<string>} regionNames - 지역명을 추가할 Set.
 * @param {Function} log - 로그 출력 함수.
 */
const loadRegionJSON = async (regionNames, log) => {
  const files = ["./regions.json", "./regions2.json"];

  for (const file of files) {
    try {
      const res = await fetch(file);
      if (!res.ok) continue;

      const json = await res.json();
      let count = 0;

      if (json.data && Array.isArray(json.data)) {
        json.data.forEach((item) => {
          if (item.title) {
            regionNames.add(item.title);
            count++;
          }
        });
      }

      log(`  - ${file}: 지역 ${count}개 로드`, "info");
    } catch (e) {
      console.warn(`Failed to load ${file}:`, e);
    }
  }
};

/**
 * 번역 CSV 파일에서 지역명을 로드합니다.
 * @param {Set<string>} regionNames - 지역명을 추가할 Set.
 * @param {Function} log - 로그 출력 함수.
 */
const loadTranslationCSV = async (regionNames, log) => {
  const files = ["./translation.csv", "./translation2.csv"];

  for (const file of files) {
    try {
      const res = await fetch(file);
      if (!res.ok) continue;

      const text = await res.text();
      const lines = text.split("\n");
      let regionCount = 0;

      const headerLine = lines[0] || "";
      const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase());

      const koreanIndex = headers.findIndex((h) => h === "korean");
      const keyIndex = headers.findIndex((h) => h === "key");
      const regionIndex = headers.findIndex((h) => h === "region");
      const typeIndex = headers.findIndex((h) => h === "type");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = parseCSVLine(line);

        const type = typeIndex !== -1 ? parts[typeIndex] : "";
        const key = keyIndex !== -1 ? parts[keyIndex] : "";
        const korean = koreanIndex !== -1 ? parts[koreanIndex] : "";
        const region = regionIndex !== -1 ? parts[regionIndex] : "";

        if (type === "Common") {
          if (key && !regionNames.has(key)) {
            regionNames.add(key);
            regionCount++;
          }
          if (korean && !regionNames.has(korean)) {
            regionNames.add(korean);
            regionCount++;
          }
        }

        if (region && !regionNames.has(region)) {
          regionNames.add(region);
          regionCount++;
        }
      }

      if (regionCount > 0) {
        log(`  - ${file}: 번역 지역 ${regionCount}개 로드`, "info");
      }
    } catch (e) {
      console.warn(`Failed to load translation ${file}:`, e);
    }
  }
};

/**
 * 캐시된 데이터를 삭제합니다.
 */
export const clearDataCache = () => {
  cachedData = null;
};

/**
 * 캐시된 데이터를 가져옵니다.
 * @returns {LoadedData|null} 캐시된 데이터 또는 null.
 */
export const getCachedData = () => cachedData;
