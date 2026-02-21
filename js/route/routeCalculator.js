// @ts-check

/**
 * 두 지점 사이의 하버사인 거리(km)를 계산합니다.
 * @param {number} lat1 - 첫 번째 지점 위도.
 * @param {number} lng1 - 첫 번째 지점 경도.
 * @param {number} lat2 - 두 번째 지점 위도.
 * @param {number} lng2 - 두 번째 지점 경도.
 * @returns {number} 킬로미터 단위 거리.
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
 * 단순 유클리드 거리를 계산합니다.
 * @param {number} lat1 - 첫 번째 지점 위도.
 * @param {number} lng1 - 첫 번째 지점 경도.
 * @param {number} lat2 - 두 번째 지점 위도.
 * @param {number} lng2 - 두 번째 지점 경도.
 * @returns {number} 거리.
 */
export const calculateSimpleDistance = (lat1, lng1, lat2, lng2) => {
  const dx = lat2 - lat1;
  const dy = lng2 - lng1;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * 지점들 사이의 거리 행렬을 생성합니다.
 * @param {Array<{lat: number, lng: number}>} points - 지점 배열.
 * @returns {number[][]} 거리 행렬.
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
 * 경로 최적화를 위한 최근접 이웃(Nearest Neighbor) 알고리즘.
 * @param {Array<{lat: number, lng: number}>} points - 지점 배열.
 * @param {number} [startIndex=0] - 시작 인덱스.
 * @returns {{route: number[], totalDistance: number, distMatrix?: number[][]}} 결과.
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
 * 경로 최적화를 위한 2-opt 개선 알고리즘.
 * @param {number[]} route - 초기 경로.
 * @param {number[][]} distMatrix - 거리 행렬.
 * @param {number} [maxIterations=1000] - 최대 반복 횟수.
 * @returns {{route: number[], totalDistance: number}} 개선된 경로.
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
 * 주어진 항목들에 대해 최적의 경로를 계산합니다.
 * @param {any[]} items - 경로를 계산할 항목들.
 * @param {{lat: number, lng: number}|null} [startPoint=null] - 시작 지점.
 * @param {{useOptimization?: boolean}} [options] - 옵션.
 * @returns {{route: any[], totalDistance: number, pointCount?: number}} 결과.
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
 * 필터에 따라 경로용 항목들을 가져옵니다.
 * @param {any} mapData - 지도 데이터 객체.
 * @param {string} region - 지역명.
 * @param {string[]} categories - 카테고리 ID 목록.
 * @param {Set<any>} [completedIds=new Set()] - 제외할 완료된 ID 목록.
 * @returns {any[]} 필터링된 항목들.
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
 * 지역 내의 비석(축지석 등)을 찾습니다.
 * @param {any} mapData - 지도 데이터 객체.
 * @param {string} region - 지역명.
 * @returns {{lat: number, lng: number, item: any}|null} 비석 위치 또는 null.
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
