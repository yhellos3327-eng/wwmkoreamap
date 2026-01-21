// @ts-check
import { state as appState } from "../state.js";
import { logger } from "../logger.js";
import { getRouteState, setRouteState } from "./routeState.js";
import { enterRouteMode, displayRoute } from "./routeCore.js";

/**
 * Generates a shareable URL for the current route.
 * @returns {string|null} The share URL or null.
 */
export const generateShareUrl = () => {
  const state = getRouteState();
  if (!state.currentRoute) return null;

  const routeData = {
    ids: state.currentRoute.route.map((p) => p.id),
    region: state.currentRoute.region,
    name: state.currentRoute.name || "Shared Route",
  };

  const encoded = btoa(JSON.stringify(routeData));
  const url = new URL(window.location.href);
  url.searchParams.set("route", encoded);

  return url.toString();
};

/**
 * Loads a route from URL parameters.
 * @returns {boolean} Whether a route was loaded.
 */
export const loadRouteFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const routeParam = urlParams.get("route");

  if (!routeParam) return false;

  try {
    const routeData = JSON.parse(atob(routeParam));

    if (!routeData.ids || !Array.isArray(routeData.ids)) return false;

    /**
     * Checks if data is ready and loads the route.
     */
    const checkAndLoad = () => {
      if (!appState.mapData?.items) {
        setTimeout(checkAndLoad, 500);
        return;
      }

      const items = routeData.ids
        .map((id, index) => {
          const item = appState.mapData.items.find((i) => i.id === id);
          return item
            ? {
                ...item,
                lat: parseFloat(item.x),
                lng: parseFloat(item.y),
                order: index + 1,
              }
            : null;
        })
        .filter(Boolean);

      if (items.length === 0) return;

      const route = {
        route: items,
        region: routeData.region || "shared",
        categories: [],
        totalDistance: 0,
        pointCount: items.length,
        createdAt: new Date().toISOString(),
        isManual: true,
        name: routeData.name,
      };

      setRouteState("currentRoute", route);
      setRouteState("currentStepIndex", 0);
      enterRouteMode();
      displayRoute();

      logger.success("RouteMode", `Loaded shared route: ${routeData.name}`);
    };

    checkAndLoad();
    return true;
  } catch (e) {
    logger.error("RouteMode", "Failed to parse route from URL");
    return false;
  }
};

/**
 * Copies the share URL to clipboard.
 * @returns {Promise<boolean>} Whether copying succeeded.
 */
export const copyShareUrl = async () => {
  const url = generateShareUrl();
  if (!url) return false;

  try {
    await navigator.clipboard.writeText(url);
    logger.success("RouteMode", "Share URL copied to clipboard");
    return true;
  } catch (e) {
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    logger.success("RouteMode", "Share URL copied to clipboard");
    return true;
  }
};
