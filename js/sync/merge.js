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
 * @returns {Array<{id: any, completedAt: any}>}// Normalizes markers to ensure they have an ID and completedAt
// Also deduplicates by ID to prevent "double-click" issues
const normalizeMarkers = (arr) => {
  if (!Array.isArray(arr)) return [];
  const uniqueMap = new Map();
  
  arr.forEach((item) => {
    let id, completedAt;
    if (typeof item === "object" && item !== null) {
      id = String(item.id);
      completedAt = item.completedAt;
    } else {
      id = String(item);
      completedAt = Date.now();
    }
    
    // If ID exists, keep the one with newer timestamp, or existing if same
    const existing = uniqueMap.get(id);
    if (!existing) {
      uniqueMap.set(id, { id, completedAt });
    } else if (completedAt && existing.completedAt && new Date(completedAt) > new Date(existing.completedAt)) {
      uniqueMap.set(id, { id, completedAt });
    }
  });

  return Array.from(uniqueMap.values());
};

/**
 * Merges two marker arrays with conflict resolution (3-Way Merge).
 * @param {any[]} localArr - Local markers.
 * @param {any[]} cloudArr - Cloud markers.
 * @param {any[]} [baseArr=[]] - Base markers (snapshot from last sync).
 * @returns {any[]} Merged markers.
 */
const mergeArrays = (localArr, cloudArr, baseArr = []) => {
  const localNormalized = normalizeMarkers(localArr);
  const cloudNormalized = normalizeMarkers(cloudArr);
  const baseNormalized = normalizeMarkers(baseArr);

  const mergedMap = new Map();
  const allIds = new Set();

  const localMap = new Map();
  localNormalized.forEach(i => { const id = String(getMarkerId(i)); localMap.set(id, i); allIds.add(id); });

  const cloudMap = new Map();
  cloudNormalized.forEach(i => { const id = String(getMarkerId(i)); cloudMap.set(id, i); allIds.add(id); });

  const baseMap = new Map();
  baseNormalized.forEach(i => { const id = String(getMarkerId(i)); baseMap.set(id, i); allIds.add(id); });

  allIds.forEach(id => {
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);
    const base = baseMap.get(id);

    // 1. Present in both Local and Cloud -> Merge (Newest wins or Keep)
    if (local && cloud) {
      // If conflict, check timestamps if available
      if (local.completedAt && cloud.completedAt) {
        const localTime = new Date(local.completedAt).getTime();
        const cloudTime = new Date(cloud.completedAt).getTime();
        mergedMap.set(id, localTime >= cloudTime ? local : cloud);
      } else {
        // Default to local if no timestamps (or arbitrary stability)
        mergedMap.set(id, local);
      }
      return;
    }

    // 2. Present in Local, Missing in Cloud
    if (local && !cloud) {
      if (base) {
        // Was in Base, now missing in Cloud -> Deleted Remotely
        // Action: Delete (Do not add to mergedMap)
      } else {
        // Not in Base -> Added Locally
        // Action: Keep
        mergedMap.set(id, local);
      }
      return;
    }

    // 3. Missing in Local, Present in Cloud
    if (!local && cloud) {
      if (base) {
        // Was in Base, now missing in Local -> Deleted Locally
        // Action: Delete (Do not add to mergedMap)
      } else {
        // Not in Base -> Added Remotely
        // Action: Keep
        mergedMap.set(id, cloud);
      }
      return;
    }

    // 4. Missing in both (should not happen given we iterate Union)
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
 * Merges full data objects (3-Way Merge).
 * @param {any} local - Local data.
 * @param {any} cloud - Cloud data.
 * @param {any} [base={}] - Base data (snapshot).
 * @returns {{completedMarkers: any[], favorites: any[], settings: any}} Merged data.
 */
export const mergeData = (local, cloud, base = {}) => {
  const merged = {
    completedMarkers: mergeArrays(
      local?.completedMarkers || [],
      cloud?.completedMarkers || [],
      base?.completedMarkers || []
    ),
    favorites: mergeArrays(
      local?.favorites || [],
      cloud?.favorites || [],
      base?.favorites || []
    ),
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
