export const STORAGE_KEYS = {
    COMPLETED: 'wwm_completed',
    FAVORITES: 'wwm_favorites',
    SHOW_COMMENTS: 'wwm_show_comments',
    CLOSE_ON_COMPLETE: 'wwm_close_on_complete',
    AI_PROVIDER: 'wwm_ai_provider',
    API_KEY: 'wwm_api_key',
    OPENAI_KEY: 'wwm_openai_key',
    CLAUDE_KEY: 'wwm_claude_key',
    API_MODEL: 'wwm_api_model',
    REGION_COLOR: 'wwm_region_color',
    REGION_FILL_COLOR: 'wwm_region_fill_color',
    HIDE_COMPLETED: 'wwm_hide_completed',
    ENABLE_CLUSTERING: 'wwm_enable_clustering',
    SHOW_AD: 'wwm_show_ad',
    REPORT_TARGET: 'wwm_report_target',
    CLEANUP_LAST_RUN: 'wwm_cleanup_last_run',

    activeCats: (mapKey) => `wwm_active_cats_${mapKey}`,
    activeRegs: (mapKey) => `wwm_active_regs_${mapKey}`,
    favorites: (mapKey) => `wwm_favorites_${mapKey}`,
    noticeHidden: (noticeId) => `wwm_notice_hidden_${noticeId}`
};

export const storage = {
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return item;
        } catch (e) {
            console.warn('[Storage] Read error:', e);
            return defaultValue;
        }
    },

    getJSON: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (e) {
            console.warn('[Storage] JSON parse error:', e);
            return defaultValue;
        }
    },

    set: (key, value) => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('[Storage] Write error:', e);
            return false;
        }
    },

    setJSON: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('[Storage] JSON stringify error:', e);
            return false;
        }
    },

    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('[Storage] Remove error:', e);
            return false;
        }
    },

    getBool: (key, defaultValue = false) => {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        return value === 'true';
    },

    getBoolInverse: (key, defaultValue = true) => {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        return value !== 'false';
    }
};

export const persistState = {
    saveCompleted: (list) => storage.setJSON(STORAGE_KEYS.COMPLETED, list),
    loadCompleted: () => storage.getJSON(STORAGE_KEYS.COMPLETED, []),

    saveFavorites: (list) => storage.setJSON(STORAGE_KEYS.FAVORITES, list),
    loadFavorites: () => storage.getJSON(STORAGE_KEYS.FAVORITES, []),

    saveFavoritesForMap: (mapKey, list) => storage.setJSON(STORAGE_KEYS.favorites(mapKey), list),
    loadFavoritesForMap: (mapKey) => storage.getJSON(STORAGE_KEYS.favorites(mapKey), []),

    saveActiveCats: (mapKey, ids) => storage.setJSON(STORAGE_KEYS.activeCats(mapKey), [...ids]),
    loadActiveCats: (mapKey) => storage.getJSON(STORAGE_KEYS.activeCats(mapKey), []),

    saveActiveRegs: (mapKey, names) => storage.setJSON(STORAGE_KEYS.activeRegs(mapKey), [...names]),
    loadActiveRegs: (mapKey) => storage.getJSON(STORAGE_KEYS.activeRegs(mapKey), []),

    saveSettings: (settings) => {
        if (settings.aiProvider !== undefined) storage.set(STORAGE_KEYS.AI_PROVIDER, settings.aiProvider);
        if (settings.apiKey !== undefined) storage.set(STORAGE_KEYS.API_KEY, settings.apiKey);
        if (settings.openaiKey !== undefined) storage.set(STORAGE_KEYS.OPENAI_KEY, settings.openaiKey);
        if (settings.claudeKey !== undefined) storage.set(STORAGE_KEYS.CLAUDE_KEY, settings.claudeKey);
        if (settings.apiModel !== undefined) storage.set(STORAGE_KEYS.API_MODEL, settings.apiModel);
        if (settings.regionColor !== undefined) storage.set(STORAGE_KEYS.REGION_COLOR, settings.regionColor);
        if (settings.regionFillColor !== undefined) storage.set(STORAGE_KEYS.REGION_FILL_COLOR, settings.regionFillColor);
        if (settings.hideCompleted !== undefined) storage.set(STORAGE_KEYS.HIDE_COMPLETED, settings.hideCompleted);
        if (settings.enableClustering !== undefined) storage.set(STORAGE_KEYS.ENABLE_CLUSTERING, settings.enableClustering);
        if (settings.showComments !== undefined) storage.set(STORAGE_KEYS.SHOW_COMMENTS, settings.showComments);
        if (settings.closeOnComplete !== undefined) storage.set(STORAGE_KEYS.CLOSE_ON_COMPLETE, settings.closeOnComplete);
        if (settings.showAd !== undefined) storage.set(STORAGE_KEYS.SHOW_AD, settings.showAd);
    },

    loadSettings: () => ({
        aiProvider: storage.get(STORAGE_KEYS.AI_PROVIDER, 'gemini'),
        apiKey: storage.get(STORAGE_KEYS.API_KEY, ''),
        openaiKey: storage.get(STORAGE_KEYS.OPENAI_KEY, ''),
        claudeKey: storage.get(STORAGE_KEYS.CLAUDE_KEY, ''),
        apiModel: storage.get(STORAGE_KEYS.API_MODEL, 'gemini-1.5-flash'),
        regionColor: storage.get(STORAGE_KEYS.REGION_COLOR, '#242424'),
        regionFillColor: storage.get(STORAGE_KEYS.REGION_FILL_COLOR, '#ffbd53'),
        hideCompleted: storage.getBool(STORAGE_KEYS.HIDE_COMPLETED, false),
        enableClustering: storage.getBoolInverse(STORAGE_KEYS.ENABLE_CLUSTERING, true),
        showComments: storage.getBoolInverse(STORAGE_KEYS.SHOW_COMMENTS, true),
        closeOnComplete: storage.getBool(STORAGE_KEYS.CLOSE_ON_COMPLETE, false),
        showAd: storage.getBoolInverse(STORAGE_KEYS.SHOW_AD, true)
    })
};
