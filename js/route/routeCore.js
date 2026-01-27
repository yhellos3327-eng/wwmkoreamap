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
 * Toggles route mode on/off.
 * @returns {boolean} New active state.
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
 * Enters route mode.
 */
export const enterRouteMode = () => {
  setRouteState("active", true);
  setRouteState("previousRegionState", new Set(appState.activeRegionNames));
  logger.log("RouteMode", "Entering route mode");
  renderRouteUI();
};

/**
 * Exits route mode.
 */
export const exitRouteMode = () => {
  clearRouteDisplay();
  hideRouteUI();
  restoreAllRegions();
  resetRouteState();
  logger.log("RouteMode", "Exiting route mode");
};

/**
 * Restores all regions to active state.
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
 * Sets only the specified region as active.
 * @param {string} region - The region name to activate.
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
 * Generates an optimized route for the given region and categories.
 * @param {string} region - The region name.
 * @param {string[]} [categories=[]] - Category IDs to include.
 * @param {boolean} [excludeCompleted=true] - Whether to exclude completed items.
 * @returns {any|null} The generated route or null.
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
 * Displays the current route on the map.
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
 * Clears the route display from the map.
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
 * Saves the current route to localStorage.
 * @param {string} [name] - Optional route name.
 * @returns {Promise<boolean>} Whether save was successful.
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
 * Loads a saved route by ID.
 * @param {string} routeId - The route ID to load.
 * @returns {Promise<any|null>} The loaded route or null.
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
 * Gets all saved routes.
 * @returns {Promise<any[]>} Array of saved routes.
 */
export const getSavedRoutes = async () => {
  const { primaryDb } = await import("../storage/db.js");
  return (await primaryDb.get("wwm_saved_routes")) || [];
};

/**
 * Deletes a saved route by ID.
 * @param {string} routeId - The route ID to delete.
 * @returns {Promise<boolean>} Whether deletion was successful.
 */
export const deleteRoute = async (routeId) => {
  const { primaryDb } = await import("../storage/db.js");
  let savedRoutes = (await primaryDb.get("wwm_saved_routes")) || [];
  savedRoutes = savedRoutes.filter((r) => r.id !== routeId);
  await primaryDb.set("wwm_saved_routes", savedRoutes);
  return true;
};

/**
 * Gets available regions for routing.
 * @returns {string[]} Array of region names.
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
 * Gets statistics for the specified region and categories.
 * @param {string} region - The region name.
 * @param {string[]} [categories=[]] - Category IDs.
 * @returns {{total: number, completed: number, remaining: number}} Stats.
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
