// @ts-check

/**
 * Calculates haversine distance between two points (in km).
 * @param {number} lat1 - First point latitude.
 * @param {number} lng1 - First point longitude.
 * @param {number} lat2 - Second point latitude.
 * @param {number} lng2 - Second point longitude.
 * @returns {number} Distance in kilometers.
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculates simple Euclidean distance.
 * @param {number} lat1 - First point latitude.
 * @param {number} lng1 - First point longitude.
 * @param {number} lat2 - Second point latitude.
 * @param {number} lng2 - Second point longitude.
 * @returns {number} Distance.
 */
export const calculateSimpleDistance = (lat1, lng1, lat2, lng2) => {
  const dx = lat2 - lat1;
  const dy = lng2 - lng1;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Builds a distance matrix for points.
 * @param {Array<{lat: number, lng: number}>} points - Array of points.
 * @returns {number[][]} Distance matrix.
 */
const buildDistanceMatrix = (points) => {
  const n = points.length;
  const matrix = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = calculateSimpleDistance(
        points[i].lat,
        points[i].lng,
        points[j].lat,
        points[j].lng,
      );
      matrix[i][j] = dist;
      matrix[j][i] = dist;
    }
  }

  return matrix;
};

/**
 * Nearest neighbor algorithm for route optimization.
 * @param {Array<{lat: number, lng: number}>} points - Array of points.
 * @param {number} [startIndex=0] - Starting index.
 * @returns {{route: number[], totalDistance: number, distMatrix?: number[][]}} Result.
 */
export const nearestNeighbor = (points, startIndex = 0) => {
  if (points.length === 0) return { route: [], totalDistance: 0 };
  if (points.length === 1) return { route: [0], totalDistance: 0 };

  const n = points.length;
  const distMatrix = buildDistanceMatrix(points);
  const visited = new Set();
  const route = [startIndex];
  visited.add(startIndex);

  let current = startIndex;
  let totalDistance = 0;

  while (visited.size < n) {
    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distMatrix[current][i] < nearestDist) {
        nearestDist = distMatrix[current][i];
        nearestIdx = i;
      }
    }

    if (nearestIdx !== -1) {
      route.push(nearestIdx);
      visited.add(nearestIdx);
      totalDistance += nearestDist;
      current = nearestIdx;
    }
  }

  return { route, totalDistance, distMatrix };
};

/**
 * 2-opt improvement algorithm for route optimization.
 * @param {number[]} route - Initial route.
 * @param {number[][]} distMatrix - Distance matrix.
 * @param {number} [maxIterations=1000] - Maximum iterations.
 * @returns {{route: number[], totalDistance: number}} Improved route.
 */
export const twoOptImprove = (route, distMatrix, maxIterations = 1000) => {
  let improved = true;
  let iterations = 0;
  let bestRoute = [...route];

  const calculateTotalDistance = (r) => {
    let total = 0;
    for (let i = 0; i < r.length - 1; i++) {
      total += distMatrix[r[i]][r[i + 1]];
    }
    return total;
  };

  let bestDistance = calculateTotalDistance(bestRoute);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < bestRoute.length - 1; i++) {
      for (let j = i + 1; j < bestRoute.length; j++) {
        const newRoute = [
          ...bestRoute.slice(0, i),
          ...bestRoute.slice(i, j + 1).reverse(),
          ...bestRoute.slice(j + 1),
        ];

        const newDistance = calculateTotalDistance(newRoute);

        if (newDistance < bestDistance) {
          bestRoute = newRoute;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }

  return { route: bestRoute, totalDistance: bestDistance };
};

/**
 * Calculates the optimal route for given items.
 * @param {any[]} items - Items to route.
 * @param {{lat: number, lng: number}|null} [startPoint=null] - Starting point.
 * @param {{useOptimization?: boolean}} [options] - Options.
 * @returns {{route: any[], totalDistance: number, pointCount?: number}} Result.
 */
export const calculateOptimalRoute = (
  items,
  startPoint = null,
  options = {},
) => {
  const { useOptimization = true } = options;

  if (!items || items.length === 0) {
    return { route: [], totalDistance: 0 };
  }

  const points = items.map((item) => ({
    ...item,
    lat: parseFloat(item.x),
    lng: parseFloat(item.y),
  }));

  let startIndex = 0;
  if (startPoint) {
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = calculateSimpleDistance(
        startPoint.lat,
        startPoint.lng,
        points[i].lat,
        points[i].lng,
      );
      if (dist < minDist) {
        minDist = dist;
        startIndex = i;
      }
    }
  }

  const nnResult = nearestNeighbor(points, startIndex);

  let finalRoute = nnResult.route;
  let finalDistance = nnResult.totalDistance;

  if (useOptimization && points.length > 3 && points.length < 500) {
    const improved = twoOptImprove(nnResult.route, nnResult.distMatrix);
    finalRoute = improved.route;
    finalDistance = improved.totalDistance;
  }

  const orderedRoute = finalRoute.map((idx, order) => ({
    ...points[idx],
    order: order + 1,
  }));

  return {
    route: orderedRoute,
    totalDistance: finalDistance,
    pointCount: points.length,
  };
};

/**
 * Gets items for a route based on filters.
 * @param {any} mapData - Map data object.
 * @param {string} region - Region name.
 * @param {string[]} categories - Category IDs.
 * @param {Set<any>} [completedIds=new Set()] - Completed IDs to exclude.
 * @returns {any[]} Filtered items.
 */
export const getItemsForRoute = (
  mapData,
  region,
  categories,
  completedIds = new Set(),
) => {
  if (!mapData || !mapData.items) return [];

  return mapData.items.filter((item) => {
    const itemRegion = item.forceRegion || item.region;
    const matchesRegion = region === "all" || itemRegion === region;
    const matchesCategory =
      categories.length === 0 || categories.includes(item.category);
    const notCompleted = !completedIds.has(item.id);

    return matchesRegion && matchesCategory && notCompleted;
  });
};

/**
 * Finds a boundary stone in a region.
 * @param {any} mapData - Map data object.
 * @param {string} region - Region name.
 * @returns {{lat: number, lng: number, item: any}|null} Boundary stone or null.
 */
export const findBoundaryStone = (mapData, region) => {
  if (!mapData || !mapData.items) return null;

  const BOUNDARY_STONE_CATEGORY = "17310010083";

  const boundaryStone = mapData.items.find((item) => {
    const itemRegion = item.forceRegion || item.region;
    return (
      item.category === BOUNDARY_STONE_CATEGORY &&
      (region === "all" || itemRegion === region)
    );
  });

  if (boundaryStone) {
    return {
      lat: parseFloat(boundaryStone.x),
      lng: parseFloat(boundaryStone.y),
      item: boundaryStone,
    };
  }

  return null;
};
