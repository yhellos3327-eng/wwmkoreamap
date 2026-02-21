// @ts-check
/**
 * @fileoverview Route core module - handles route generation, display, and management.
 * @module route/routeCore
 */

const L = /** @type {any} */ (window).L;
import { state as appState } from "../state.js";
import { logger } from "../logger.js";
import { getRouteState, setRouteState, resetRouteState } from "./routeState.js";
import { renderRouteUI, hideRouteUI, updateRouteProgress } from "./routeUI.js";
import {
  getItemsForRoute,
  findBoundaryStone,
  calculateOptimalRoute,
} from "./routeCalculator.js";
import { goToStep } from "./routeNavigation.js";

/** @type {string[]} */
const EXCLUDED_REGIONS = [
  "all",
  "전체 지역",
  "지역 미할당",
  "알 수 없음",
  "Unknown",
];

/**
 * 경로 모드를 켜거나 끕니다.
 * @returns {boolean} 새로운 활성 상태.
 */
export const toggleRouteMode = () => {
  const state = getRouteState();
  if (state.active) {
    exitRouteMode();
  } else {
    enterRouteMode();
  }
  return !state.active;
};

/**
 * 경로 모드에 진입합니다.
 */
export const enterRouteMode = () => {
  setRouteState("active", true);
  setRouteState("previousRegionState", new Set(appState.activeRegionNames));
  logger.log("RouteMode", "Entering route mode");
  renderRouteUI();
};

/**
 * 경로 모드에서 나갑니다.
 */
export const exitRouteMode = () => {
  clearRouteDisplay();
  hideRouteUI();
  restoreAllRegions();
  resetRouteState();
  logger.log("RouteMode", "Exiting route mode");
};

/**
 * 모든 지역을 활성 상태로 복원합니다.
 */
const restoreAllRegions = () => {
  appState.activeRegionNames.clear();
  appState.uniqueRegions.forEach((r) => appState.activeRegionNames.add(r));

  import("../ui/sidebar.js")
    .then((/** @type {any} */ module) => {
      if (module.renderRegionButtons) {
        module.renderRegionButtons();
      }
    })
    .catch(() => { });

  import("../map/markers.js")
    .then((/** @type {any} */ module) => {
      if (module.renderMapDataAndMarkers) {
        module.renderMapDataAndMarkers();
      }
    })
    .catch(() => { });
};

/**
 * 지정된 지역만 활성 상태로 설정합니다.
 * @param {string} region - 활성화할 지역명.
 */
const setOnlyRegionActive = (region) => {
  appState.activeRegionNames.clear();
  appState.activeRegionNames.add(region);

  import("../ui/sidebar.js")
    .then((/** @type {any} */ module) => {
      if (module.renderRegionButtons) {
        module.renderRegionButtons();
      }
    })
    .catch(() => { });

  import("../map/markers.js")
    .then((/** @type {any} */ module) => {
      if (module.renderMapDataAndMarkers) {
        module.renderMapDataAndMarkers();
      }
    })
    .catch(() => { });
};

/**
 * 주어진 지역과 카테고리에 대해 최적화된 경로를 생성합니다.
 * @param {string} region - 지역명.
 * @param {string[]} [categories=[]] - 포함할 카테고리 ID 목록.
 * @param {boolean} [excludeCompleted=true] - 완료된 항목 제외 여부.
 * @returns {any|null} 생성된 경로 또는 null.
 */
export const generateRoute = (
  region,
  categories = [],
  excludeCompleted = true,
) => {
  if (!appState.mapData || !appState.mapData.items) {
    logger.error("RouteMode", "No map data available");
    return null;
  }

  const completedIds = excludeCompleted
    ? new Set(appState.completedList.map((c) => c.id))
    : new Set();

  const items = getItemsForRoute(
    appState.mapData,
    region,
    categories,
    completedIds,
  );

  if (items.length === 0) {
    logger.warn("RouteMode", "No items found for route");
    return null;
  }

  const startPoint = findBoundaryStone(appState.mapData, region);
  const result = calculateOptimalRoute(items, startPoint, {
    useOptimization: true,
  });

  const route = {
    ...result,
    region,
    categories,
    startPoint,
    createdAt: new Date().toISOString(),
  };

  setRouteState("currentRoute", route);
  setRouteState("currentStepIndex", 0);

  if (region && region !== "all") {
    setOnlyRegionActive(region);
  }

  logger.success(
    "RouteMode",
    `Generated route with ${result.pointCount} points`,
  );

  return route;
};

/**
 * 현재 경로를 지도에 표시합니다.
 */
export const displayRoute = () => {
  const state = getRouteState();
  if (!state.currentRoute || !appState.map) return;

  clearRouteDisplay();

  const { route } = state.currentRoute;

  const polylineCoords = route.map((point) => [point.lat, point.lng]);

  if (!appState.map.getPane("routePane")) {
    appState.map.createPane("routePane");
    appState.map.getPane("routePane").style.zIndex = 650;
    appState.map.getPane("routePane").style.pointerEvents = "none";
  }

  const polyline = L.polyline(polylineCoords, {
    color: "#daac71",
    weight: 4,
    opacity: 0.9,
    pane: "routePane",
    className: "route-polyline",
  }).addTo(appState.map);

  setRouteState("routePolyline", polyline);

  const markers = [];
  route.forEach((point, index) => {
    const isCompleted = appState.completedList.some((c) => c.id === point.id);
    const isCurrent = index === state.currentStepIndex;

    const markerHtml = `
            <div class="route-badge-marker ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}">
                ${point.order}
            </div>
        `;

    const icon = L.divIcon({
      html: markerHtml,
      className: "route-badge-container",
      iconSize: [16, 16],
      iconAnchor: [8, 30],
    });

    const marker = L.marker([point.lat, point.lng], {
      icon,
      pane: "routePane",
      zIndexOffset: isCurrent ? 1000 : 100,
      interactive: false,
    }).addTo(appState.map);

    markers.push(marker);
  });

  setRouteState("routeMarkers", markers);

  if (polylineCoords.length > 0) {
    const bounds = L.latLngBounds(polylineCoords);
    appState.map.fitBounds(bounds.pad(0.1));
  }

  updateRouteProgress(state.currentRoute, state.currentStepIndex);
};

/**
 * 지도에서 경로 표시를 제거합니다.
 */
export const clearRouteDisplay = () => {
  const state = getRouteState();

  if (state.routePolyline && appState.map) {
    appState.map.removeLayer(state.routePolyline);
    setRouteState("routePolyline", null);
  }

  state.routeMarkers.forEach((marker) => {
    if (appState.map) appState.map.removeLayer(marker);
  });
  setRouteState("routeMarkers", []);
};

/**
 * 현재 경로를 저장합니다.
 * @param {string} [name] - 경로 이름 (선택 사항).
 * @returns {Promise<boolean>} 저장 성공 여부.
 */
export const saveRoute = async (name) => {
  const state = getRouteState();
  if (!state.currentRoute) return false;

  const { primaryDb } = await import("../storage/db.js");
  const savedRoutes = (await primaryDb.get("wwm_saved_routes")) || [];

  const routeToSave = {
    id: Date.now().toString(),
    name: name || `Route ${savedRoutes.length + 1}`,
    region: state.currentRoute.region,
    categories: state.currentRoute.categories,
    route: state.currentRoute.route.map((p) => ({ id: p.id, order: p.order })),
    createdAt: state.currentRoute.createdAt,
    isManual: state.currentRoute.isManual || false,
  };

  savedRoutes.push(routeToSave);
  await primaryDb.set("wwm_saved_routes", savedRoutes);

  logger.success("RouteMode", `Route saved: ${routeToSave.name}`);
  return true;
};

/**
 * ID로 저장된 경로를 불러옵니다.
 * @param {string} routeId - 불러올 경로 ID.
 * @returns {Promise<any|null>} 불러온 경로 또는 null.
 */
export const loadRoute = async (routeId) => {
  const { primaryDb } = await import("../storage/db.js");
  const savedRoutes = (await primaryDb.get("wwm_saved_routes")) || [];
  const savedRoute = savedRoutes.find((r) => r.id === routeId);

  if (!savedRoute) {
    logger.error("RouteMode", "Route not found");
    return null;
  }

  const items = savedRoute.route
    .map((saved) => {
      const item = appState.mapData.items.find((i) => i.id === saved.id);
      return item
        ? {
          ...item,
          order: saved.order,
          lat: parseFloat(item.x),
          lng: parseFloat(item.y),
        }
        : null;
    })
    .filter(Boolean);

  const route = {
    route: items,
    region: savedRoute.region,
    categories: savedRoute.categories,
    totalDistance: 0,
    pointCount: items.length,
    createdAt: savedRoute.createdAt,
    isManual: savedRoute.isManual || false,
  };

  setRouteState("currentRoute", route);
  setRouteState("currentStepIndex", 0);

  if (
    savedRoute.region &&
    savedRoute.region !== "all" &&
    savedRoute.region !== "manual"
  ) {
    setOnlyRegionActive(savedRoute.region);
  }

  return route;
};

/**
 * 모든 저장된 경로를 가져옵니다.
 * @returns {Promise<any[]>} 저장된 경로 배열.
 */
export const getSavedRoutes = async () => {
  const { primaryDb } = await import("../storage/db.js");
  return (await primaryDb.get("wwm_saved_routes")) || [];
};

/**
 * ID로 저장된 경로를 삭제합니다.
 * @param {string} routeId - 삭제할 경로 ID.
 * @returns {Promise<boolean>} 삭제 성공 여부.
 */
export const deleteRoute = async (routeId) => {
  const { primaryDb } = await import("../storage/db.js");
  let savedRoutes = (await primaryDb.get("wwm_saved_routes")) || [];
  savedRoutes = savedRoutes.filter((r) => r.id !== routeId);
  const result = await primaryDb.set("wwm_saved_routes", savedRoutes);
  if (!result || !result.success) {
    logger.error("RouteMode", `Failed to delete route: ${result?.error || "Unknown error"}`);
    return false;
  }
  logger.success("RouteMode", `Route deleted: ${routeId}`);
  return true;
};

/**
 * 경로 생성에 사용 가능한 지역 목록을 가져옵니다.
 * @returns {string[]} 지역명 배열.
 */
export const getAvailableRegions = () => {
  if (!appState.mapData || !appState.mapData.items) return [];

  const regions = new Set();
  appState.mapData.items.forEach((item) => {
    const region = item.forceRegion || item.region;
    if (region && !EXCLUDED_REGIONS.includes(region)) {
      regions.add(region);
    }
  });

  return Array.from(regions).sort();
};

/**
 * 지정된 지역과 카테고리에 대한 통계를 가져옵니다.
 * @param {string} region - 지역명.
 * @param {string[]} [categories=[]] - 카테고리 ID 목록.
 * @returns {{total: number, completed: number, remaining: number}} 통계.
 */
export const getRouteStats = (region, categories = []) => {
  if (!appState.mapData || !appState.mapData.items)
    return { total: 0, completed: 0, remaining: 0 };

  const completedIds = new Set(appState.completedList.map((c) => c.id));

  let total = 0;
  let completed = 0;

  appState.mapData.items.forEach((item) => {
    const itemRegion = item.forceRegion || item.region;
    const matchesRegion = region === "all" || itemRegion === region;
    const matchesCategory =
      categories.length === 0 || categories.includes(item.category);

    if (matchesRegion && matchesCategory) {
      total++;
      if (completedIds.has(item.id)) completed++;
    }
  });

  return { total, completed, remaining: total - completed };
};
