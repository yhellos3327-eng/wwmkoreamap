// @ts-check

/**
 * Gets marker ID from a marker object or value.
 * @param {any} marker - The marker.
 * @returns {any} The marker ID.
 */
export const getMarkerId = (marker) => {
  if (typeof marker === "object" && marker !== null) return marker.id;
  return marker;
};

/**
 * Normalizes markers to consistent object format.
 * @param {any[]} markers - The markers array.
 * @returns {Array<{id: any, completedAt: any}>} Normalized markers.
 */
const normalizeMarkers = (markers) => {
  if (!Array.isArray(markers)) return [];
  return markers.map((marker) => {
    if (typeof marker === "object" && marker !== null) return marker;
    return { id: marker, completedAt: null };
  });
};

/**
 * Merges two marker arrays with conflict resolution.
 * @param {any[]} localArr - Local markers.
 * @param {any[]} cloudArr - Cloud markers.
 * @returns {any[]} Merged markers.
 */
const mergeArrays = (localArr, cloudArr) => {
  const localNormalized = normalizeMarkers(localArr);
  const cloudNormalized = normalizeMarkers(cloudArr);
  const mergedMap = new Map();

  cloudNormalized.forEach((item) => {
    mergedMap.set(getMarkerId(item), item);
  });

  localNormalized.forEach((item) => {
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

/**
 * Merges two settings objects with timestamp-based conflict resolution.
 * @param {any} localSettings - Local settings.
 * @param {any} cloudSettings - Cloud settings.
 * @returns {any} Merged settings.
 */
const mergeSettings = (localSettings, cloudSettings) => {
  const merged = {};
  const mergedTimestamps = {};
  const localTimestamps = localSettings._updatedAt || {};
  const cloudTimestamps = cloudSettings._updatedAt || {};

  const allKeys = new Set([
    ...Object.keys(localSettings).filter((k) => k !== "_updatedAt"),
    ...Object.keys(cloudSettings).filter((k) => k !== "_updatedAt"),
  ]);

  allKeys.forEach((key) => {
    const localValue = localSettings[key];
    const cloudValue = cloudSettings[key];
    const localTime = localTimestamps[key]
      ? new Date(localTimestamps[key]).getTime()
      : 0;
    const cloudTime = cloudTimestamps[key]
      ? new Date(cloudTimestamps[key]).getTime()
      : 0;

    if (localValue !== undefined && cloudValue !== undefined) {
      if (cloudTime > localTime) {
        merged[key] = cloudValue;
        mergedTimestamps[key] = cloudTimestamps[key];
      } else {
        merged[key] = localValue;
        mergedTimestamps[key] =
          localTimestamps[key] || new Date().toISOString();
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

  // Safety Guard: If merged is suspiciously empty but inputs weren't
  if (Object.keys(merged).length <= 1 && (Object.keys(localSettings).length > 1 || Object.keys(cloudSettings).length > 1)) {
    console.error("[Merge] Safety Guard: mergeSettings returned empty object suspiciously. Falling back to local.");
    return localSettings;
  }

  return merged;
};

/**
 * Merges local and cloud data.
 * @param {any} local - Local data.
 * @param {any} cloud - Cloud data.
 * @returns {{completedMarkers: any[], favorites: any[], settings: any}} Merged data.
 */
export const mergeData = (local, cloud) => {
  const merged = {
    completedMarkers: mergeArrays(
      local?.completedMarkers || [],
      cloud?.completedMarkers || [],
    ),
    favorites: mergeArrays(local?.favorites || [], cloud?.favorites || []),
    settings: mergeSettings(local?.settings || {}, cloud?.settings || {}),
  };

  // Safety Guard: If merged data is empty but local had data, fallback to local
  if (
    merged.completedMarkers.length === 0 &&
    local?.completedMarkers?.length > 0
  ) {
    console.warn("[Merge] Safety Guard: Merged completedMarkers is empty, falling back to local.");
    merged.completedMarkers = local.completedMarkers;
  }

  if (merged.favorites.length === 0 && local?.favorites?.length > 0) {
    console.warn("[Merge] Safety Guard: Merged favorites is empty, falling back to local.");
    merged.favorites = local.favorites;
  }

  return merged;
};

/**
 * Generates a hash for data comparison.
 * @param {any} data - The data to hash.
 * @returns {string} The hash string.
 */
export const generateDataHash = (data) => {
  // Filter and sort settings to ensure consistent string representation
  const settings = {};
  if (data?.settings) {
    Object.keys(data.settings)
      .filter((k) => !k.startsWith("_")) // Ignore internal keys like _updatedAt
      .sort()
      .forEach((k) => {
        settings[k] = data.settings[k];
      });
  }

  const str = JSON.stringify({
    completedCount: data?.completedMarkers?.length || 0,
    favoritesCount: data?.favorites?.length || 0,
    settings: settings,
  });

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36); // Use base36 for shorter string
};
