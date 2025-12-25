import { logger } from './logger.js';
import { ACTIONS } from './actions.js';

const state = {
    currentMapKey: 'qinghe',
    currentTileLayer: null,
    regionLayerGroup: null,
    map: null,
    allMarkers: [],
    pendingMarkers: [],
    regionData: [],
    koDict: {},
    mapData: { categories: [], items: [] },
    activeCategoryIds: new Set(),
    activeRegionNames: new Set(),
    uniqueRegions: new Set(),
    itemsByCategory: {},
    completedList: (() => {
        const stored = JSON.parse(localStorage.getItem('wwm_completed')) || [];
        if (stored.length > 0 && typeof stored[0] !== 'object') {
            const migrated = stored.map(id => ({ id, completedAt: null }));
            localStorage.setItem('wwm_completed', JSON.stringify(migrated));
            return migrated;
        }
        return stored;
    })(),
    favorites: JSON.parse(localStorage.getItem('wwm_favorites')) || [],
    categoryItemTranslations: {},
    currentModalList: [],
    currentLightboxImages: [],
    currentLightboxIndex: 0,
    currentLightboxMedia: [],
    showComments: localStorage.getItem('wwm_show_comments') !== 'false',
    closeOnComplete: localStorage.getItem('wwm_close_on_complete') === 'true',
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
    logger.stateChange(key, oldValue, value);

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

export const setDeep = (path, value) => {
    const keys = path.split('.');
    let current = stateProxy;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
    }
    const lastKey = keys[keys.length - 1];
    const oldValue = current[lastKey];
    current[lastKey] = value;
    notify(keys[0], stateProxy[keys[0]], stateProxy[keys[0]]);
};

export const dispatch = (actionType, payload) => {
    logger.log('State', `Dispatching Action: ${actionType}`, payload);

    switch (actionType) {
        case ACTIONS.SET_MAP:
            setState('currentMapKey', payload);
            break;
        case ACTIONS.SET_LOADING_STATE:
            setState('loadingState', { ...state.loadingState, ...payload });
            break;
        case ACTIONS.UPDATE_FILTER:
            if (payload.type === 'category') {
                if (payload.active) state.activeCategoryIds.add(payload.id);
                else state.activeCategoryIds.delete(payload.id);
                notify('activeCategoryIds', state.activeCategoryIds, state.activeCategoryIds);
            } else if (payload.type === 'region') {
                if (payload.active) state.activeRegionNames.add(payload.id);
                else state.activeRegionNames.delete(payload.id);
                notify('activeRegionNames', state.activeRegionNames, state.activeRegionNames);
            }
            break;
        case ACTIONS.SET_DEV_MODE:
            setState('isDevMode', payload);
            break;
        default:
            console.warn(`Unknown action type: ${actionType}`);
    }
};

export { stateProxy as state };
