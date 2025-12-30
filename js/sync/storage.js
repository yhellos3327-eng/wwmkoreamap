export const getLocalData = () => {
    let completedMarkers = [];
    let favorites = [];
    let settings = {};

    const completedData = localStorage.getItem('wwm_completed');
    if (completedData) {
        try { completedMarkers = JSON.parse(completedData) || []; } catch (e) { }
    }

    const favoritesData = localStorage.getItem('wwm_favorites') ||
        localStorage.getItem('wwm_favorites_qinghe') ||
        localStorage.getItem('wwm_favorites_kaifeng');
    if (favoritesData) {
        try { favorites = JSON.parse(favoritesData) || []; } catch (e) { }
    }

    const settingsUpdatedAt = localStorage.getItem('wwm_settings_updated_at');
    let settingsTimestamps = {};
    if (settingsUpdatedAt) {
        try { settingsTimestamps = JSON.parse(settingsUpdatedAt) || {}; } catch (e) { }
    }

    settings = {
        showComments: localStorage.getItem('wwm_show_comments'),
        closeOnComplete: localStorage.getItem('wwm_close_on_complete'),
        hideCompleted: localStorage.getItem('wwm_hide_completed'),
        enableClustering: localStorage.getItem('wwm_enable_clustering'),
        showAd: localStorage.getItem('wwm_show_ad'),
        regionColor: localStorage.getItem('wwm_region_color'),
        regionFillColor: localStorage.getItem('wwm_region_fill_color'),
        gpuMode: localStorage.getItem('wwm_gpu_mode'),
        activeCatsQinghe: localStorage.getItem('wwm_active_cats_qinghe'),
        activeCatsKaifeng: localStorage.getItem('wwm_active_cats_kaifeng'),
        activeRegsQinghe: localStorage.getItem('wwm_active_regs_qinghe'),
        activeRegsKaifeng: localStorage.getItem('wwm_active_regs_kaifeng'),
        favoritesQinghe: localStorage.getItem('wwm_favorites_qinghe'),
        favoritesKaifeng: localStorage.getItem('wwm_favorites_kaifeng'),
        _updatedAt: settingsTimestamps
    };

    Object.keys(settings).forEach(key => {
        if (settings[key] === null && key !== '_updatedAt') delete settings[key];
    });

    return { completedMarkers, favorites, settings };
};

export const setLocalData = (data) => {
    if (!data) return;

    if (data.completedMarkers) {
        localStorage.setItem('wwm_completed', JSON.stringify(data.completedMarkers));
    }

    if (data.favorites) {
        localStorage.setItem('wwm_favorites', JSON.stringify(data.favorites));
    }

    if (data.settings) {
        const s = data.settings;
        if (s.showComments !== undefined) localStorage.setItem('wwm_show_comments', s.showComments);
        if (s.closeOnComplete !== undefined) localStorage.setItem('wwm_close_on_complete', s.closeOnComplete);
        if (s.hideCompleted !== undefined) localStorage.setItem('wwm_hide_completed', s.hideCompleted);
        if (s.enableClustering !== undefined) localStorage.setItem('wwm_enable_clustering', s.enableClustering);
        if (s.showAd !== undefined) localStorage.setItem('wwm_show_ad', s.showAd);
        if (s.regionColor !== undefined) localStorage.setItem('wwm_region_color', s.regionColor);
        if (s.regionFillColor !== undefined) localStorage.setItem('wwm_region_fill_color', s.regionFillColor);
        if (s.gpuMode !== undefined) localStorage.setItem('wwm_gpu_mode', s.gpuMode);
        if (s.activeCatsQinghe !== undefined) localStorage.setItem('wwm_active_cats_qinghe', s.activeCatsQinghe);
        if (s.activeCatsKaifeng !== undefined) localStorage.setItem('wwm_active_cats_kaifeng', s.activeCatsKaifeng);
        if (s.activeRegsQinghe !== undefined) localStorage.setItem('wwm_active_regs_qinghe', s.activeRegsQinghe);
        if (s.activeRegsKaifeng !== undefined) localStorage.setItem('wwm_active_regs_kaifeng', s.activeRegsKaifeng);
        if (s.favoritesQinghe !== undefined) localStorage.setItem('wwm_favorites_qinghe', s.favoritesQinghe);
        if (s.favoritesKaifeng !== undefined) localStorage.setItem('wwm_favorites_kaifeng', s.favoritesKaifeng);
        if (s._updatedAt) localStorage.setItem('wwm_settings_updated_at', JSON.stringify(s._updatedAt));
    }
};
