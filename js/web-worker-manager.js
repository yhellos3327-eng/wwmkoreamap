// @ts-check
/// <reference path="./types.d.ts" />
import { logger } from "./logger.js";
import { DataParsingStrategy, FilteringStrategy } from "./worker-strategies.js";

let taskIdCounter = 0;
const pendingTasks = new Map();

class WebWorkerManager {
  constructor() {
    this.workers = {};
    this.isSupported = typeof Worker !== "undefined";
    this.strategies = new Map();
    this.registerStrategy("data", new DataParsingStrategy());
    this.registerStrategy("filter", new FilteringStrategy());
  }

  registerStrategy(name, strategy) {
    this.strategies.set(name, strategy);
  }

  getWorker(name) {
    if (!this.isSupported) return null;

    if (!this.workers[name]) {
      try {
        const workerPath = `./js/workers/${name}.js`;
        this.workers[name] = new Worker(workerPath, { type: "module" });

        this.workers[name].onmessage = (e) => {
          const { taskId, success, result, error } = e.data;
          const task = pendingTasks.get(taskId);

          if (task) {
            pendingTasks.delete(taskId);
            if (success) {
              task.resolve(result);
            } else {
              task.reject(new Error(error));
            }
          }
        };

        this.workers[name].onerror = (e) => {
          logger.error("WebWorkerManager", `Worker ${name} error:`, e);
        };

        logger.success("WebWorkerManager", `워커 생성: ${name}`);
      } catch (error) {
        logger.warn("WebWorkerManager", `워커 생성 실패 ${name}:`, error);
        return null;
      }
    }

    return this.workers[name];
  }

  async runTask(workerName, type, payload, transferList = [], timeout = 30000) {
    const worker = this.getWorker(workerName);

    if (!worker) {
      return this.fallbackSync(workerName, type, payload);
    }

    const taskId = ++taskIdCounter;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingTasks.delete(taskId);
        logger.warn("WebWorkerManager", `태스크 타임아웃, 동기 폴백: ${type}`);
        resolve(this.fallbackSync(workerName, type, payload));
      }, timeout);

      pendingTasks.set(taskId, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          logger.warn("WebWorkerManager", `태스크 실패: ${type}`, error);
          resolve(this.fallbackSync(workerName, type, payload));
        },
      });

      worker.postMessage({ type, payload, taskId }, transferList);
    });
  }

  fallbackSync(workerName, type, payload) {
    logger.log("WebWorkerManager", `동기 폴백 실행: ${type}`);

    const strategyName = workerName.replace("-worker", "");
    const strategy = this.strategies.get(strategyName);

    if (strategy) {
      try {
        return strategy.execute(type, payload);
      } catch (e) {
        logger.warn("WebWorkerManager", `전략 실행 실패 (${type}):`, e);
      }
    }

    logger.warn("WebWorkerManager", `폴백 처리 불가: ${type}`);
    return payload.items || payload;
  }

  terminateAll() {
    Object.keys(this.workers).forEach((name) => {
      this.workers[name].terminate();
      delete this.workers[name];
    });
    pendingTasks.clear();
    logger.log("WebWorkerManager", "모든 워커 종료됨");
  }

  async parseJSON(jsonString) {
    return this.runTask("data-worker", "PARSE_JSON", { jsonString });
  }

  async processCSV(csvText) {
    return this.runTask("data-worker", "PROCESS_CSV", { csvText });
  }

  async processRegionData(regionJson, koDict) {
    return this.runTask("data-worker", "PROCESS_REGION_DATA", {
      regionJson,
      koDict,
    });
  }

  async processMapData(
    rawItems,
    regionIdMap,
    missingItems,
    categoryItemTranslations,
    reverseRegionMap,
  ) {
    return this.runTask("data-worker", "PROCESS_MAP_DATA", {
      rawItems,
      regionIdMap,
      missingItems: Array.from(missingItems),
      categoryItemTranslations,
      reverseRegionMap,
    });
  }

  async filterByBounds(items, bounds, padding = 0) {
    return this.runTask("filter-worker", "FILTER_BY_BOUNDS", {
      items,
      bounds,
      padding,
    });
  }

  async filterByCategory(items, activeCategoryIds) {
    return this.runTask("filter-worker", "FILTER_BY_CATEGORY", {
      items,
      activeCategoryIds: Array.from(activeCategoryIds),
    });
  }

  async filterByRegion(items, activeRegionNames) {
    return this.runTask("filter-worker", "FILTER_BY_REGION", {
      items,
      activeRegionNames: Array.from(activeRegionNames),
    });
  }

  async applyAllFilters(items, options) {
    return this.runTask("filter-worker", "APPLY_ALL_FILTERS", {
      items,
      activeCategoryIds: options.activeCategoryIds
        ? Array.from(options.activeCategoryIds)
        : null,
      activeRegionNames: options.activeRegionNames
        ? Array.from(options.activeRegionNames)
        : null,
      completedList: options.completedList || [],
      hideCompleted: options.hideCompleted || false,
      bounds: options.bounds || null,
      padding: options.padding || 0,
      searchTerm: options.searchTerm || "",
      koDict: options.koDict || {},
    });
  }

  async search(items, searchTerm, koDict = {}) {
    return this.runTask("filter-worker", "SEARCH", {
      items,
      searchTerm,
      koDict,
    });
  }

  async buildSpatialIndex(items, cellSize = 0.02) {
    return this.runTask("filter-worker", "BUILD_SPATIAL_INDEX", {
      items,
      cellSize,
    });
  }

  async cacheUrls(urls, cacheName = "web-llm-cache") {
    return this.runTask("cache-worker", "CACHE_URLS", {
      urls,
      cacheName,
    });
  }
}

export const webWorkerManager = new WebWorkerManager();
