const state = {
    active: false,
    currentRoute: null,
    currentStepIndex: 0,
    routePolyline: null,
    routeMarkers: [],
    manualMode: false,
    manualItems: [],
    previousRegionState: null
};

export const getRouteState = () => state;

export const setRouteState = (key, value) => {
    state[key] = value;
};

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

export const isRouteModeActive = () => state.active;
export const isManualRouteMode = () => state.manualMode;
export const getCurrentRoute = () => state.currentRoute;
export const getCurrentStepIndex = () => state.currentStepIndex;
export const getManualRouteItems = () => state.manualItems;
