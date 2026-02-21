// @ts-check
import { state as appState } from "../state.js";
import { logger } from "../logger.js";
import { getRouteState, setRouteState } from "./routeState.js";
import { enterRouteMode, displayRoute } from "./routeCore.js";

/**
 * 현재 경로의 공유 가능한 URL을 생성합니다.
 * @returns {string|null} 공유 URL 또는 null.
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
 * URL 파라미터에서 경로를 불러옵니다.
 * @returns {boolean} 경로 로드 여부.
 */
export const loadRouteFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const routeParam = urlParams.get("route");

  if (!routeParam) return false;

  try {
    const routeData = JSON.parse(atob(routeParam));

    if (!routeData.ids || !Array.isArray(routeData.ids)) return false;

    /**
     * 데이터 준비 상태를 확인하고 경로를 불러옵니다.
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
 * 공유 URL을 클립보드에 복사합니다.
 * @returns {Promise<boolean>} 복사 성공 여부.
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
