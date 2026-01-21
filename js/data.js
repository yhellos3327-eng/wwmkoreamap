// @ts-check
/**
 * @fileoverview Data module - re-exports data loading and processing functionality.
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
