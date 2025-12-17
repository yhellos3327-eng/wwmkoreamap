const state = {
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
    savedAIProvider: localStorage.getItem('wwm_ai_provider') || "gemini",
    savedGeminiKey: localStorage.getItem('wwm_api_key') || "",
    savedOpenAIKey: localStorage.getItem('wwm_openai_key') || "",
    savedClaudeKey: localStorage.getItem('wwm_claude_key') || "",
    savedApiModel: localStorage.getItem('wwm_api_model') || "gemini-1.5-flash",
    savedRegionColor: localStorage.getItem('wwm_region_color') || "#242424",
    savedRegionFillColor: localStorage.getItem('wwm_region_fill_color') || "#ffbd53",
    hideCompleted: localStorage.getItem('wwm_hide_completed') === 'true',
    enableClustering: localStorage.getItem('wwm_enable_clustering') !== 'false',
    currentGuideStep: 0,
    rawCSV: null,
    parsedCSV: null,
    isDevMode: false,
    loadingState: {
        csvProgress: 0,
        mapProgress: 0,
        message: "초기화 중...",
        detail: "",
        isVisible: true
    }
};

const listeners = {};

export const subscribe = (key, callback) => {
    if (!listeners[key]) {
        listeners[key] = [];
    }
    listeners[key].push(callback);
};

export const notify = (key, value, oldValue) => {
    console.groupCollapsed(`%c[Pub/Sub] 상태 변경: ${key}`, "font-size: 12px; font-weight: bold; color: #4CAF50; background: #222; padding: 3px 6px; border-radius: 3px;");
    console.log(`이전 값:`, oldValue);
    console.log(`새로운 값:`, value);
    console.groupEnd();

    if (listeners[key]) {
        listeners[key].forEach(callback => callback(value));
    }
};

const stateProxy = new Proxy(state, {
    set(target, property, value) {
        const oldValue = target[property];
        target[property] = value;
        notify(property, value, oldValue);
        return true;
    }
});

export const setState = (key, value) => {
    stateProxy[key] = value;
};

export const getState = (key) => {
    return stateProxy[key];
};

export const updateState = (updates) => {
    Object.assign(stateProxy, updates);
};

export { stateProxy as state };
