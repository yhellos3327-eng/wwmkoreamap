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
const index = new SpatialIndex(0.02);
let allItems = [];
let currentVisibleIds = new Set();

let activeCategories = new Set();
let activeRegionNames = new Set();
let completedList = new Set();
let hideCompleted = false;

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
