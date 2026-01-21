/**
 * Map Worker - handles spatial indexing and viewport-based filtering.
 * Runs in a separate thread for performance.
 */

/**
 * Spatial index for efficient geographic queries.
 */
class SpatialIndex {
  /**
   * Creates a new spatial index.
   * @param {number} [cellSize=0.05] - The size of each grid cell.
   */
  constructor(cellSize = 0.05) {
    /** @type {number} */
    this.cellSize = cellSize;
    /** @type {Map<string, any[]>} */
    this.grid = new Map();
  }

  /**
   * Gets the cell key for given coordinates.
   * @param {number} lat - Latitude.
   * @param {number} lng - Longitude.
   * @returns {string} The cell key.
   */
  getCellKey(lat, lng) {
    const cellX = Math.floor(lng / this.cellSize);
    const cellY = Math.floor(lat / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Adds an item to the index.
   * @param {any} item - The item to add.
   */
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

  /**
   * Builds the index from an array of items.
   * @param {any[]} items - The items to index.
   */
  buildIndex(items) {
    this.grid.clear();
    items.forEach((item) => this.add(item));
  }

  /**
   * Gets items within given bounds.
   * @param {{south: number, west: number, north: number, east: number}} bounds - The bounds.
   * @param {number} [padding=0] - Padding to add to bounds.
   * @returns {any[]} Items within bounds.
   */
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

const index = new SpatialIndex(0.02);

/** @type {any[]} */
let allItems = [];

/** @type {Set<string>} */
let currentVisibleIds = new Set();

/** @type {Set<string>} */
let activeCategories = new Set();

/** @type {Set<string>} */
let activeRegionNames = new Set();

/** @type {Set<string>} */
let completedList = new Set();

/** @type {boolean} */
let hideCompleted = false;

/**
 * Message handler for worker communication.
 */
self.onmessage = function (e) {
  const { type, payload } = e.data;

  switch (type) {
    case "INIT_DATA":
      allItems = payload.items;
      index.buildIndex(allItems);
      self.postMessage({ type: "INIT_COMPLETE", count: allItems.length });
      break;

    case "UPDATE_FILTERS":
      if (payload.activeCategories)
        activeCategories = new Set(payload.activeCategories);
      if (payload.activeRegionNames)
        activeRegionNames = new Set(payload.activeRegionNames);
      if (payload.completedList) {
        const ids = payload.completedList.map((c) =>
          typeof c === "object" ? c.id : c,
        );
        completedList = new Set(ids);
      }
      if (typeof payload.hideCompleted !== "undefined")
        hideCompleted = payload.hideCompleted;
      break;

    case "UPDATE_VIEWPORT":
      handleViewportUpdate(payload.bounds, payload.padding);
      break;
  }
};

/**
 * Update the set of items visible within the given viewport and notify the main thread of any changes.
 *
 * Filters indexed candidates using activeCategories, activeRegionNames, and hideCompleted, computes items
 * to add and remove relative to the previous visible set, updates currentVisibleIds, and posts a
 * `RENDER_UPDATE` message with `{ toAdd, toRemove }` when there are changes.
 *
 * @param {{south: number, west: number, north: number, east: number}} bounds - Viewport bounds (south, west, north, east).
 * @param {number} [padding=0] - Optional padding applied to the bounds (in the same coordinate units as bounds).
 */
function handleViewportUpdate(bounds, padding = 0) {
  const candidates = index.getItemsInBounds(bounds, padding);

  const filteredItems = [];
  const newVisibleIds = new Set();

  for (const item of candidates) {
    if (activeCategories.size > 0 && !activeCategories.has(item.category))
      continue;
    const region = item.forceRegion || item.region || "알 수 없음";
    if (activeRegionNames.size > 0 && !activeRegionNames.has(region)) continue;
    if (hideCompleted && completedList.has(item.id)) continue;
    filteredItems.push(item);
    newVisibleIds.add(item.id);
  }

  const toAdd = [];
  const toRemove = [];
  for (const item of filteredItems) {
    if (!currentVisibleIds.has(item.id)) {
      toAdd.push(item);
    }
  }
  for (const id of currentVisibleIds) {
    if (!newVisibleIds.has(id)) {
      toRemove.push(id);
    }
  }
  currentVisibleIds = newVisibleIds;
  if (toAdd.length > 0 || toRemove.length > 0) {
    self.postMessage({
      type: "RENDER_UPDATE",
      payload: {
        toAdd,
        toRemove,
      },
    });
  }
}