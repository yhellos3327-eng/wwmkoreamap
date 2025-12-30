const getMarkerId = (marker) => {
    if (typeof marker === 'object' && marker !== null) return marker.id;
    return marker;
};

const normalizeMarkers = (markers) => {
    if (!Array.isArray(markers)) return [];
    return markers.map(marker => {
        if (typeof marker === 'object' && marker !== null) return marker;
        return { id: marker, completedAt: null };
    });
};

const mergeArrays = (localArr, cloudArr) => {
    const localNormalized = normalizeMarkers(localArr);
    const cloudNormalized = normalizeMarkers(cloudArr);
    const mergedMap = new Map();

    cloudNormalized.forEach(item => {
        mergedMap.set(getMarkerId(item), item);
    });

    localNormalized.forEach(item => {
        const id = getMarkerId(item);
        const existing = mergedMap.get(id);
        if (existing) {
            if (item.completedAt && existing.completedAt) {
                const localTime = new Date(item.completedAt).getTime();
                const cloudTime = new Date(existing.completedAt).getTime();
                if (localTime >= cloudTime) mergedMap.set(id, item);
            } else if (item.completedAt) {
                mergedMap.set(id, item);
            }
        } else {
            mergedMap.set(id, item);
        }
    });

    return Array.from(mergedMap.values());
};

const mergeSettings = (localSettings, cloudSettings) => {
    const merged = {};
    const mergedTimestamps = {};
    const localTimestamps = localSettings._updatedAt || {};
    const cloudTimestamps = cloudSettings._updatedAt || {};

    const allKeys = new Set([
        ...Object.keys(localSettings).filter(k => k !== '_updatedAt'),
        ...Object.keys(cloudSettings).filter(k => k !== '_updatedAt')
    ]);

    allKeys.forEach(key => {
        const localValue = localSettings[key];
        const cloudValue = cloudSettings[key];
        const localTime = localTimestamps[key] ? new Date(localTimestamps[key]).getTime() : 0;
        const cloudTime = cloudTimestamps[key] ? new Date(cloudTimestamps[key]).getTime() : 0;

        if (localValue !== undefined && cloudValue !== undefined) {
            if (cloudTime > localTime) {
                merged[key] = cloudValue;
                mergedTimestamps[key] = cloudTimestamps[key];
            } else {
                merged[key] = localValue;
                mergedTimestamps[key] = localTimestamps[key] || new Date().toISOString();
            }
        } else if (localValue !== undefined) {
            merged[key] = localValue;
            mergedTimestamps[key] = localTimestamps[key] || new Date().toISOString();
        } else if (cloudValue !== undefined) {
            merged[key] = cloudValue;
            mergedTimestamps[key] = cloudTimestamps[key] || new Date().toISOString();
        }
    });

    merged._updatedAt = mergedTimestamps;
    return merged;
};

export const mergeData = (local, cloud) => ({
    completedMarkers: mergeArrays(local?.completedMarkers || [], cloud?.completedMarkers || []),
    favorites: mergeArrays(local?.favorites || [], cloud?.favorites || []),
    settings: mergeSettings(local?.settings || {}, cloud?.settings || {})
});

export const generateDataHash = (data) => {
    const str = JSON.stringify({
        completedCount: data?.completedMarkers?.length || 0,
        favoritesCount: data?.favorites?.length || 0,
        settingsKeys: Object.keys(data?.settings || {}).sort().join(',')
    });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
};
