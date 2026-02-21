// @ts-check
/**
 * @fileoverview 데이터 모듈 - 데이터 로드 및 처리 기능을 다시 내보냅니다.
 * @module data
 */

export {
  loadMapData,
  saveFilterState,
  loadTranslations,
  loadFavorites,
  loadCategoryFilters,
  loadRegionFilters,
  initializeFiltersFromStorage,
  processRegionData,
  processMapData,
  parseMissingItems,
  parseJSONData,
  sortItemsByCategory,
  collectUniqueRegions,
  USE_WORKERS,
} from "./data/index.js";
