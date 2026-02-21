// @ts-check

/**
 * @typedef {Object} RouteState
 * @property {boolean} active - Whether route mode is active.
 * @property {any} currentRoute - The current route object.
 * @property {number} currentStepIndex - Current step index.
 * @property {any} routePolyline - Leaflet polyline object.
 * @property {any[]} routeMarkers - Array of route markers.
 * @property {boolean} manualMode - Whether manual mode is active.
 * @property {any[]} manualItems - Items in manual route.
 * @property {Set<string>|null} previousRegionState - Previous region state for restoration.
 */

/** @type {RouteState} */
const state = {
  active: false,
  currentRoute: null,
  currentStepIndex: 0,
  routePolyline: null,
  routeMarkers: [],
  manualMode: false,
  manualItems: [],
  previousRegionState: null,
};

/**
 * 현재 경로 상태를 가져옵니다.
 * @returns {RouteState} 경로 상태.
 */
export const getRouteState = () => state;

/**
 * 경로 상태 속성을 설정합니다.
 * @param {keyof RouteState} key - 상태 키.
 * @param {any} value - 설정할 값.
 */
export const setRouteState = (key, value) => {
  /** @type {any} */ (state)[key] = value;
};

/**
 * 경로 상태를 초기 값으로 리셋합니다.
 */
export const resetRouteState = () => {
  state.active = false;
  state.currentRoute = null;
  state.currentStepIndex = 0;
  state.routePolyline = null;
  state.routeMarkers = [];
  state.manualMode = false;
  state.manualItems = [];
  state.previousRegionState = null;
};

/**
 * 경로 모드가 활성 상태인지 확인합니다.
 * @returns {boolean} 경로 모드 활성 여부.
 */
export const isRouteModeActive = () => state.active;

/**
 * 직접 구성 경로 모드가 활성 상태인지 확인합니다.
 * @returns {boolean} 직접 구성 모드 활성 여부.
 */
export const isManualRouteMode = () => state.manualMode;

/**
 * 현재 경로를 가져옵니다.
 * @returns {any} 현재 경로.
 */
export const getCurrentRoute = () => state.currentRoute;

/**
 * 현재 단계 인덱스를 가져옵니다.
 * @returns {number} 현재 단계 인덱스.
 */
export const getCurrentStepIndex = () => state.currentStepIndex;

/**
 * 직접 구성 경로 항목들을 가져옵니다.
 * @returns {any[]} 직접 구성 경로 항목 배열.
 */
export const getManualRouteItems = () => state.manualItems;
