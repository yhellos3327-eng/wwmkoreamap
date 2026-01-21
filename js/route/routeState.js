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
 * Gets the current route state.
 * @returns {RouteState} The route state.
 */
export const getRouteState = () => state;

/**
 * Sets a route state property.
 * @param {keyof RouteState} key - The state key.
 * @param {any} value - The value to set.
 */
export const setRouteState = (key, value) => {
  state[key] = value;
};

/**
 * Resets the route state to initial values.
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
 * Checks if route mode is active.
 * @returns {boolean} Whether route mode is active.
 */
export const isRouteModeActive = () => state.active;

/**
 * Checks if manual route mode is active.
 * @returns {boolean} Whether manual mode is active.
 */
export const isManualRouteMode = () => state.manualMode;

/**
 * Gets the current route.
 * @returns {any} The current route.
 */
export const getCurrentRoute = () => state.currentRoute;

/**
 * Gets the current step index.
 * @returns {number} The current step index.
 */
export const getCurrentStepIndex = () => state.currentStepIndex;

/**
 * Gets the manual route items.
 * @returns {any[]} The manual route items.
 */
export const getManualRouteItems = () => state.manualItems;
