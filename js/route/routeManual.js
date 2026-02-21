// @ts-check
import { state as appState } from "../state.js";
import { logger } from "../logger.js";
import { getRouteState, setRouteState } from "./routeState.js";
import { updateManualRouteUI } from "./routeUI.js";

/**
 * 직접 구성 경로 모드를 토글합니다.
 * @param {boolean} enabled - 직접 구성 모드 활성화 여부.
 */
export const toggleManualRouteMode = (enabled) => {
  setRouteState("manualMode", enabled);
  if (!enabled) {
    setRouteState("manualItems", []);
  }
  logger.log("RouteMode", `Manual route mode: ${enabled ? "ON" : "OFF"}`);
};

/**
 * 직접 구성 경로에 항목을 추가합니다.
 * @param {string|number} itemId - 추가할 항목 ID.
 * @returns {boolean} 항목 추가 성공 여부.
 */
export const addToManualRoute = (itemId) => {
  const state = getRouteState();
  if (!state.manualMode) return false;

  const itemIdStr = String(itemId);
  const item = appState.mapData?.items?.find((i) => String(i.id) === itemIdStr);

  if (!item) return false;
  if (state.manualItems.some((i) => String(i.id) === itemIdStr)) {
    return false;
  }

  const newItems = [
    ...state.manualItems,
    {
      ...item,
      lat: parseFloat(item.x),
      lng: parseFloat(item.y),
      order: state.manualItems.length + 1,
    },
  ];

  setRouteState("manualItems", newItems);
  updateManualRouteUI(newItems);
  return true;
};

/**
 * 직접 구성 경로에서 항목을 제거합니다.
 * @param {string|number} itemId - 제거할 항목 ID.
 * @returns {boolean} 항목 제거 성공 여부.
 */
export const removeFromManualRoute = (itemId) => {
  const state = getRouteState();
  const itemIdStr = String(itemId);
  const index = state.manualItems.findIndex((i) => String(i.id) === itemIdStr);

  if (index === -1) return false;

  const newItems = [...state.manualItems];
  newItems.splice(index, 1);
  newItems.forEach((item, idx) => {
    item.order = idx + 1;
  });

  setRouteState("manualItems", newItems);
  updateManualRouteUI(newItems);
  return true;
};

/**
 * 직접 구성 경로의 항목 순서를 변경합니다.
 * @param {number} fromIndex - 원래 인덱스.
 * @param {number} toIndex - 대상 인덱스.
 * @returns {boolean} 순서 변경 성공 여부.
 */
export const reorderManualRoute = (fromIndex, toIndex) => {
  const state = getRouteState();
  const items = [...state.manualItems];

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return false;
  }

  const [item] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, item);
  items.forEach((item, idx) => {
    item.order = idx + 1;
  });

  setRouteState("manualItems", items);
  updateManualRouteUI(items);
  return true;
};

/**
 * 직접 구성한 경로를 현재 경로로 적용합니다.
 * @returns {any|null} 생성된 경로 또는 null.
 */
export const applyManualRoute = () => {
  const state = getRouteState();

  if (state.manualItems.length === 0) {
    logger.warn("RouteMode", "No items in manual route");
    return null;
  }

  const route = {
    route: [...state.manualItems],
    region: "manual",
    categories: [],
    totalDistance: 0,
    pointCount: state.manualItems.length,
    createdAt: new Date().toISOString(),
    isManual: true,
  };

  setRouteState("currentRoute", route);
  setRouteState("currentStepIndex", 0);
  setRouteState("manualMode", false);

  logger.success(
    "RouteMode",
    `Applied manual route with ${state.manualItems.length} points`,
  );

  return route;
};
