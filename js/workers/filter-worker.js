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

const filterByCategory = (items, activeCategoryIds) => {
  const activeSet = new Set(activeCategoryIds);
  return items.filter((item) => activeSet.has(item.category));
};

const filterByRegion = (items, activeRegionNames) => {
  const activeSet = new Set(activeRegionNames);
  return items.filter((item) => {
    
    const region = item.forceRegion ?? item.region ?? "알 수 없음";
    return activeSet.has(region);
  });
};

const filterCompleted = (items, completedList, hideCompleted) => {
  if (!hideCompleted) return items;
  const completedIds = completedList.map((c) =>
    typeof c === "object" ? c.id : c,
  );
  const completedSet = new Set(completedIds);
  return items.filter((item) => !completedSet.has(item.id));
};

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

const buildSpatialIndex = (items, cellSize = 0.02) => {
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
