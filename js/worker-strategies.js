/**
 * 워커 태스크 처리를 위한 기본 전략 클래스.
 */
class TaskStrategy {
  /**
   * 태스크를 실행합니다.
   * @param {any} payload - 태스크 데이터.
   */
  execute(payload) {
    throw new Error("Method 'execute' must be implemented.");
  }
}

/**
 * 데이터 파싱 태스크를 처리하는 전략 클래스.
 */
export class DataParsingStrategy extends TaskStrategy {
  /**
   * 데이터 파싱 태스크를 실행합니다.
   * @param {string} type - 태스크 타입.
   * @param {any} payload - 태스크 데이터.
   */
  execute(type, payload) {
    switch (type) {
      case "PARSE_JSON":
        return JSON.parse(payload.jsonString);
      case "PROCESS_CSV":
        return this.processCSV(payload.csvText);
      default:
        throw new Error(`Unknown data parsing task: ${type}`);
    }
  }

  processCSV(csvText) {
    const koDict = {};
    const categoryItemTranslations = {};
    const parsedCSV = [];

    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0)
      return { koDict, categoryItemTranslations, parsedCSV };

    const headerLine = lines.shift();
    const headers = this.parseCSVLine(headerLine);
    parsedCSV.push(headers);

    const typeIdx = headers.indexOf("Type");
    const keyIdx = headers.indexOf("Key");
    const valIdx = headers.indexOf("Korean");

    lines.forEach((line) => {
      if (!line.trim()) return;
      const parsed = this.parseCSVLine(line);
      if (!parsed || parsed.length < 3) return;

      parsedCSV.push(parsed);

      const type = parsed[typeIdx]?.trim();
      const key = parsed[keyIdx]?.trim();
      if (!key) return;

      if (type === "Common") {
        const val = parsed[valIdx];
        if (val) koDict[key] = val;
      }
    });

    return { koDict, categoryItemTranslations, parsedCSV };
  }

  parseCSVLine(str) {
    const arr = [];
    let quote = false;
    let value = "";

    for (let i = 0; i < str.length; i++) {
      const cc = str[i];
      const nc = str[i + 1];

      if (cc === '"' && quote && nc === '"') {
        value += cc;
        i++;
      } else if (cc === '"') {
        quote = !quote;
      } else if (cc === "," && !quote) {
        arr.push(value);
        value = "";
      } else {
        value += cc;
      }
    }
    arr.push(value);
    return arr;
  }
}

export class FilteringStrategy extends TaskStrategy {
  constructor() {
    super();
    this.spatialIndex = null;
  }

  execute(type, payload) {
    switch (type) {
      case "BUILD_SPATIAL_INDEX":
        this.buildSpatialIndex(payload.items, payload.cellSize);
        return { success: true, count: payload.items.length };
      case "FILTER_BY_BOUNDS":
        if (this.spatialIndex) {
          return this.spatialIndex.getItemsInBounds(
            payload.bounds,
            payload.padding,
          );
        }
        return this.filterByBounds(
          payload.items,
          payload.bounds,
          payload.padding,
        );
      case "FILTER_BY_CATEGORY":
        return payload.items.filter((item) =>
          new Set(payload.activeCategoryIds).has(item.category),
        );
      case "FILTER_BY_REGION":
        return payload.items.filter((item) => {
          const region = item.forceRegion || item.region || "알 수 없음";
          return new Set(payload.activeRegionNames).has(region);
        });
      case "SEARCH":
        return this.search(payload.items, payload.searchTerm);
      default:
        throw new Error(`Unknown filtering task: ${type}`);
    }
  }

  buildSpatialIndex(items, cellSize = 0.05) {
    this.spatialIndex = new SpatialIndex(cellSize);
    this.spatialIndex.buildIndex(items);
  }

  filterByBounds(items, bounds, padding = 0) {
    const minLat = bounds.south - padding;
    const maxLat = bounds.north + padding;
    const minLng = bounds.west - padding;
    const maxLng = bounds.east + padding;

    return items.filter((item) => {
      const lat = parseFloat(item.x);
      const lng = parseFloat(item.y);
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    });
  }

  search(items, searchTerm) {
    const term = (searchTerm || "").toLowerCase().trim();
    if (!term) return items;
    return items.filter((item) => {
      const name = (item.name || "").toLowerCase();
      const desc = (item.description || "").toLowerCase();
      return name.includes(term) || desc.includes(term);
    });
  }
}

class SpatialIndex {
  constructor(cellSize = 0.05) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  getCellKey(lat, lng) {
    const cellX = Math.floor(lng / this.cellSize);
    const cellY = Math.floor(lat / this.cellSize);
    return `${cellX},${cellY}`;
  }

  add(item) {
    const lat = parseFloat(item.x);
    const lng = parseFloat(item.y);
    if (isNaN(lat) || isNaN(lng)) return;

    const key = this.getCellKey(lat, lng);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key).push(item);
  }

  buildIndex(items) {
    this.grid.clear();
    items.forEach((item) => this.add(item));
  }

  getItemsInBounds(bounds, padding = 0) {
    const swLat = bounds.south - padding;
    const swLng = bounds.west - padding;
    const neLat = bounds.north + padding;
    const neLng = bounds.east + padding;

    const minCellX = Math.floor(swLng / this.cellSize);
    const maxCellX = Math.floor(neLng / this.cellSize);
    const minCellY = Math.floor(swLat / this.cellSize);
    const maxCellY = Math.floor(neLat / this.cellSize);

    const items = [];
    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        const cellKey = `${x},${y}`;
        const cellItems = this.grid.get(cellKey);
        if (cellItems) {
          for (const item of cellItems) {
            const lat = parseFloat(item.x);
            const lng = parseFloat(item.y);
            if (lat >= swLat && lat <= neLat && lng >= swLng && lng <= neLng) {
              items.push(item);
            }
          }
        }
      }
    }
    return items;
  }
}
