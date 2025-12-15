export const state = {
    currentMapKey: 'qinghe',
    currentTileLayer: null,
    regionLayerGroup: null,
    map: null,
    allMarkers: [],
    regionData: [],
    koDict: {},
    mapData: { categories: [], items: [] },
    activeCategoryIds: new Set(),
    activeRegionNames: new Set(),
    uniqueRegions: new Set(),
    itemsByCategory: {},
    completedList: JSON.parse(localStorage.getItem('wwm_completed')) || [],
    favorites: JSON.parse(localStorage.getItem('wwm_favorites')) || [],
    categoryItemTranslations: {},
    currentModalList: [],
    currentLightboxImages: [],
    currentLightboxIndex: 0,
    regionMetaInfo: {},
    savedApiKey: localStorage.getItem('wwm_api_key') || "",
    savedRegionColor: localStorage.getItem('wwm_region_color') || "#242424",
    savedRegionFillColor: localStorage.getItem('wwm_region_fill_color') || "#ffbd53",
    hideCompleted: localStorage.getItem('wwm_hide_completed') === 'true',
    currentGuideStep: 0,
    rawCSV: null,
    parsedCSV: null,
    isDevMode: false
};

// Getters and Setters for state management
export const setState = (key, value) => {
    state[key] = value;
};

export const getState = (key) => {
    return state[key];
};

// Helper to update specific properties if needed
export const updateState = (updates) => {
    Object.assign(state, updates);
};
