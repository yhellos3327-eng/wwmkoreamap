// @ts-check
/**
 * @fileoverview Filter worker - handles item filtering in a Web Worker.
 * @module workers/filter-worker
 */

/**
 * @typedef {Object} Bounds
 * @property {number} north - North boundary.
 * @property {number} south - South boundary.
 * @property {number} east - East boundary.
 * @property {number} west - West boundary.
 */

/**
 * @typedef {Object} MapItem
 * @property {string|number} id - Item ID.
 * @property {string} x - Latitude as string.
 * @property {string} y - Longitude as string.
 * @property {string} category - Category ID.
 * @property {string} [region] - Region name.
 * @property {string} [forceRegion] - Forced region name.
 * @property {string} [name] - Item name.
 * @property {string} [description] - Item description.
 */

/**
 * Filters items by geographic bounds.
 * @param {MapItem[]} items - Items to filter.
 * @param {Bounds} bounds - Geographic bounds.
 * @param {number} [padding=0] - Padding to add to bounds.
 * @returns {MapItem[]} Filtered items.
 */
const filterByBounds = (items, bounds, padding = 0) => {
  const minLat = bounds.south - padding;
  const maxLat = bounds.north + padding;
  const minLng = bounds.west - padding;
  const maxLng = bounds.east + padding;

  return items.filter((item) => {
    const lat = parseFloat(item.x);
    const lng = parseFloat(item.y);
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
};

/**
 * Filters items by active category IDs.
 * @param {MapItem[]} items - Items to filter.
 * @param {string[]} activeCategoryIds - Active category IDs.
 * @returns {MapItem[]} Filtered items.
 */
const filterByCategory = (items, activeCategoryIds) => {
  const activeSet = new Set(activeCategoryIds);
  return items.filter((item) => activeSet.has(item.category));
};

/**
 * Filters items by active region names.
 * @param {MapItem[]} items - Items to filter.
 * @param {string[]} activeRegionNames - Active region names.
 * @returns {MapItem[]} Filtered items.
 */
const filterByRegion = (items, activeRegionNames) => {
  const activeSet = new Set(activeRegionNames);
  return items.filter((item) => {
    const region = item.forceRegion ?? item.region ?? "알 수 없음";
    return activeSet.has(region);
  });
};

/**
 * Filters out completed items.
 * @param {MapItem[]} items - Items to filter.
 * @param {any[]} completedList - Completed items list.
 * @param {boolean} hideCompleted - Whether to hide completed items.
 * @returns {MapItem[]} Filtered items.
 */
const filterCompleted = (items, completedList, hideCompleted) => {
  if (!hideCompleted) return items;
  const completedIds = completedList.map((c) =>
    typeof c === "object" ? c.id : c,
  );
  const completedSet = new Set(completedIds);
  return items.filter((item) => !completedSet.has(item.id));
};

/**
 * Searches items by term.
 * @param {MapItem[]} items - Items to search.
 * @param {string} searchTerm - Search term.
 * @param {Object<string, string>} [koDict={}] - Translation dictionary.
 * @returns {MapItem[]} Matching items.
 */
const searchItems = (items, searchTerm, koDict = {}) => {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return items;

  return items.filter((item) => {
    const name = (item.name ?? "").toLowerCase();
    const desc = (item.description ?? "").toLowerCase();
    const region = (koDict[item.region] ?? item.region ?? "").toLowerCase();
    const category = (
      koDict[item.category] ??
      item.category ??
      ""
    ).toLowerCase();

    return (
      name.includes(term) ||
      desc.includes(term) ||
      region.includes(term) ||
      category.includes(term)
    );
  });
};

/**
 * Sorts items by specified field.
 * @param {MapItem[]} items - Items to sort.
 * @param {string} sortBy - Field to sort by ('name', 'region', 'category').
 * @param {Object<string, string>} [koDict={}] - Translation dictionary.
 * @returns {MapItem[]} Sorted items.
 */
const sortItems = (items, sortBy, koDict = {}) => {
  const sorted = [...items];

  switch (sortBy) {
    case "name":
      sorted.sort((a, b) => {
        const nameA = koDict[a.name] ?? a.name ?? "";
        const nameB = koDict[b.name] ?? b.name ?? "";
        return nameA.localeCompare(nameB, "ko");
      });
      break;
    case "region":
      sorted.sort((a, b) => {
        const regionA = koDict[a.region] ?? a.region ?? "";
        const regionB = koDict[b.region] ?? b.region ?? "";
        return regionA.localeCompare(regionB, "ko");
      });
      break;
    case "category":
      sorted.sort((a, b) => {
        const catA = koDict[a.category] ?? a.category ?? "";
        const catB = koDict[b.category] ?? b.category ?? "";
        return catA.localeCompare(catB, "ko");
      });
      break;
  }

  return sorted;
};

/**
 * Builds a spatial index grid for items.
 * @param {MapItem[]} items - Items to index.
 * @param {number} [cellSize=0.02] - Grid cell size.
 * @returns {Object<string, MapItem[]>} Spatial index grid.
 */
const buildSpatialIndex = (items, cellSize = 0.02) => {
  /** @type {Object<string, MapItem[]>} */
  const grid = {};

  items.forEach((item) => {
    const lat = parseFloat(item.x);
    const lng = parseFloat(item.y);
    if (isNaN(lat) || isNaN(lng)) return;

    const cellX = Math.floor(lng / cellSize);
    const cellY = Math.floor(lat / cellSize);
    const key = `${cellX},${cellY}`;

    grid[key] ??= [];
    grid[key].push(item);
  });

  return grid;
};

/**
 * Gets items from spatial index within bounds.
 * @param {Object<string, MapItem[]>} grid - Spatial index grid.
 * @param {Bounds} bounds - Geographic bounds.
 * @param {number} [cellSize=0.02] - Grid cell size.
 * @param {number} [padding=0] - Padding ratio.
 * @returns {MapItem[]} Items within bounds.
 */
const getItemsFromSpatialIndex = (
  grid,
  bounds,
  cellSize = 0.02,
  padding = 0,
) => {
  const width = Math.abs(bounds.east - bounds.west);
  const height = Math.abs(bounds.north - bounds.south);

  const widthBuffer = width * padding;
  const heightBuffer = height * padding;

  const paddedWest = bounds.west - widthBuffer;
  const paddedEast = bounds.east + widthBuffer;
  const paddedSouth = bounds.south - heightBuffer;
  const paddedNorth = bounds.north + heightBuffer;

  const minCellX = Math.floor(paddedWest / cellSize);
  const maxCellX = Math.floor(paddedEast / cellSize);
  const minCellY = Math.floor(paddedSouth / cellSize);
  const maxCellY = Math.floor(paddedNorth / cellSize);

  const items = [];
  for (let x = minCellX; x <= maxCellX; x++) {
    for (let y = minCellY; y <= maxCellY; y++) {
      const key = `${x},${y}`;
      const cellItems = grid[key];
      if (cellItems) {
        for (const item of cellItems) {
          const lat = parseFloat(item.x);
          const lng = parseFloat(item.y);
          if (
            lat >= paddedSouth &&
            lat <= paddedNorth &&
            lng >= paddedWest &&
            lng <= paddedEast
          ) {
            items.push(item);
          }
        }
      }
    }
  }

  return items;
};

/**
 * Message handler for the filter worker.
 * @param {MessageEvent} e - The message event.
 */
self.onmessage = function (e) {
  const { type, payload, taskId } = e.data;

  try {
    let result;

    switch (type) {
      case "FILTER_BY_BOUNDS":
        result = filterByBounds(payload.items, payload.bounds, payload.padding);
        break;

      case "FILTER_BY_CATEGORY":
        result = filterByCategory(payload.items, payload.activeCategoryIds);
        break;

      case "FILTER_BY_REGION":
        result = filterByRegion(payload.items, payload.activeRegionNames);
        break;

      case "FILTER_COMPLETED":
        result = filterCompleted(
          payload.items,
          payload.completedList,
          payload.hideCompleted,
        );
        break;

      case "SEARCH":
        result = searchItems(payload.items, payload.searchTerm, payload.koDict);
        break;

      case "SORT":
        result = sortItems(payload.items, payload.sortBy, payload.koDict);
        break;

      case "APPLY_ALL_FILTERS":
        let items = payload.items;

        if (payload.activeCategoryIds && payload.activeCategoryIds.length > 0) {
          items = filterByCategory(items, payload.activeCategoryIds);
        }
        if (payload.activeRegionNames && payload.activeRegionNames.length > 0) {
          items = filterByRegion(items, payload.activeRegionNames);
        }
        if (payload.hideCompleted && payload.completedList) {
          items = filterCompleted(items, payload.completedList, true);
        }
        if (payload.bounds) {
          items = filterByBounds(items, payload.bounds, payload.padding || 0);
        }
        if (payload.searchTerm) {
          items = searchItems(items, payload.searchTerm, payload.koDict);
        }

        result = items;
        break;

      case "BUILD_SPATIAL_INDEX":
        result = buildSpatialIndex(payload.items, payload.cellSize);
        break;

      case "GET_FROM_SPATIAL_INDEX":
        result = getItemsFromSpatialIndex(
          payload.grid,
          payload.bounds,
          payload.cellSize,
          payload.padding,
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
