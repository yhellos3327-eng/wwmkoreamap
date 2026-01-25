// @ts-check

/**
 * @typedef {Object} SyncData
 * @property {any[]} completedMarkers - Completed markers array.
 * @property {any[]} favorites - Favorites array.
 * @property {any} settings - Settings object.
 */

/**
 * Gets local data from localStorage.
 * @returns {SyncData} The local data.
 */
export const getLocalData = () => {
  let completedMarkers = [];
  let favorites = [];
  let settings = {};

  const completedData = localStorage.getItem("wwm_completed");
  if (completedData) {
    try {
      completedMarkers = JSON.parse(completedData) || [];
    } catch (e) { }
  }

  const favoritesData =
    localStorage.getItem("wwm_favorites") ||
    localStorage.getItem("wwm_favorites_qinghe") ||
    localStorage.getItem("wwm_favorites_kaifeng");
  if (favoritesData) {
    try {
      favorites = JSON.parse(favoritesData) || [];
    } catch (e) { }
  }

  const settingsUpdatedAt = localStorage.getItem("wwm_settings_updated_at");
  let settingsTimestamps = {};
  if (settingsUpdatedAt) {
    try {
      settingsTimestamps = JSON.parse(settingsUpdatedAt) || {};
    } catch (e) { }
  }

  /**
   * Gets a boolean value from localStorage.
   * @param {string} key - The storage key.
   * @param {boolean} defaultVal - Default value.
   * @returns {boolean} The boolean value.
   */
  const getBool = (key, defaultVal) => {
    const val = localStorage.getItem(key);
    if (val === null) return defaultVal;
    return val === "true";
  };

  /**
   * Gets a JSON value from localStorage.
   * @param {string} key - The storage key.
   * @param {any} defaultVal - Default value.
   * @returns {any} The parsed JSON value.
   */
  const getJson = (key, defaultVal = []) => {
    const val = localStorage.getItem(key);
    if (!val) return defaultVal;
    try {
      return JSON.parse(val);
    } catch {
      return defaultVal;
    }
  };

  settings = {
    showComments: getBool("wwm_show_comments", true),
    closeOnComplete: getBool("wwm_close_on_complete", false),
    hideCompleted: getBool("wwm_hide_completed", false),
    enableClustering: getBool("wwm_enable_clustering", true),
    showAd: getBool("wwm_show_ad", true),
    regionColor: localStorage.getItem("wwm_region_color"),
    regionFillColor: localStorage.getItem("wwm_region_fill_color"),
    gpuMode:
      localStorage.getItem("wwm_gpu_setting") ||
      localStorage.getItem("wwm_gpu_mode"),
    activeCatsQinghe: getJson("wwm_active_cats_qinghe"),
    activeCatsKaifeng: getJson("wwm_active_cats_kaifeng"),
    activeRegsQinghe: getJson("wwm_active_regs_qinghe"),
    activeRegsKaifeng: getJson("wwm_active_regs_kaifeng"),
    favoritesQinghe: getJson("wwm_favorites_qinghe"),
    favoritesKaifeng: getJson("wwm_favorites_kaifeng"),
    activeCatsDreamsunsun: getJson("wwm_active_cats_dreamsunsun"),
    activeRegsDreamsunsun: getJson("wwm_active_regs_dreamsunsun"),
    favoritesDreamsunsun: getJson("wwm_favorites_dreamsunsun"),
    _updatedAt: settingsTimestamps,
  };

  Object.keys(settings).forEach((key) => {
    if (settings[key] === null || settings[key] === undefined) {
      if (key !== "_updatedAt") delete settings[key];
    }
  });

  return { completedMarkers, favorites, settings };
};

/**
 * Safety thresholds for data protection.
 * If current data exceeds these counts and new data is empty, block the overwrite.
 */
const SAFETY_CONFIG = {
  /** Minimum items before blocking empty overwrite */
  MIN_COMPLETED_THRESHOLD: 1,
  /** Minimum favorites before blocking empty overwrite */
  MIN_FAVORITES_THRESHOLD: 1,
  /** Maximum allowed data loss ratio (0.5 = 50%) */
  MAX_LOSS_RATIO: 0.5,
};

/**
 * @typedef {Object} SetLocalDataResult
 * @property {boolean} success - Whether the operation succeeded.
 * @property {boolean} blocked - Whether the operation was blocked by safety guard.
 * @property {string} [reason] - Reason for blocking.
 */

/**
 * Sets local data to localStorage with enhanced safety guards.
 * SAFETY FIX: Improved threshold logic and separate handling for each data type.
 * @param {SyncData} data - The data to save.
 * @returns {SetLocalDataResult} The result of the operation.
 */
export const setLocalData = (data) => {
  if (!data) return { success: false, blocked: false, reason: "No data provided" };

  let completedBlocked = false;
  let favoritesBlocked = false;

  // Handle completedMarkers with safety guard
  if (data.completedMarkers !== undefined) {
    const currentRaw = localStorage.getItem("wwm_completed");
    let currentCount = 0;
    let currentData = [];

    if (currentRaw) {
      try {
        currentData = JSON.parse(currentRaw);
        currentCount = Array.isArray(currentData) ? currentData.length : 0;
      } catch (e) {
        console.warn("[Storage] Failed to parse current completedMarkers:", e);
      }
    }

    const newCount = Array.isArray(data.completedMarkers) ? data.completedMarkers.length : 0;

    // SAFETY FIX: Enhanced protection logic
    // Block if: current has data AND new is empty or significantly less
    if (currentCount > SAFETY_CONFIG.MIN_COMPLETED_THRESHOLD) {
      if (newCount === 0) {
        console.error("[Storage] BLOCKED: Attempt to overwrite", currentCount, "completed items with empty array.");
        completedBlocked = true;
      } else if (newCount < currentCount * SAFETY_CONFIG.MAX_LOSS_RATIO) {
        // More than 50% data loss - suspicious
        console.error("[Storage] BLOCKED: Suspicious data loss detected.", currentCount, "→", newCount);
        completedBlocked = true;
      }
    }

    if (!completedBlocked) {
      localStorage.setItem("wwm_completed", JSON.stringify(data.completedMarkers));
    }
  }

  // Handle favorites with safety guard (separate from completedMarkers)
  if (data.favorites !== undefined) {
    const currentRaw = localStorage.getItem("wwm_favorites");
    let currentCount = 0;

    if (currentRaw) {
      try {
        const currentData = JSON.parse(currentRaw);
        currentCount = Array.isArray(currentData) ? currentData.length : 0;
      } catch (e) {
        console.warn("[Storage] Failed to parse current favorites:", e);
      }
    }

    const newCount = Array.isArray(data.favorites) ? data.favorites.length : 0;

    // SAFETY FIX: Same protection for favorites
    if (currentCount > SAFETY_CONFIG.MIN_FAVORITES_THRESHOLD) {
      if (newCount === 0) {
        console.error("[Storage] BLOCKED: Attempt to overwrite", currentCount, "favorites with empty array.");
        favoritesBlocked = true;
      } else if (newCount < currentCount * SAFETY_CONFIG.MAX_LOSS_RATIO) {
        console.error("[Storage] BLOCKED: Suspicious favorites loss.", currentCount, "→", newCount);
        favoritesBlocked = true;
      }
    }

    // SAFETY FIX: Save favorites even if completed was blocked (separate handling)
    if (!favoritesBlocked) {
      localStorage.setItem("wwm_favorites", JSON.stringify(data.favorites));
    }
  }

  if (data.settings) {
    const s = data.settings;
    if (s.showComments !== undefined)
      localStorage.setItem("wwm_show_comments", s.showComments);
    if (s.closeOnComplete !== undefined)
      localStorage.setItem("wwm_close_on_complete", s.closeOnComplete);
    if (s.hideCompleted !== undefined)
      localStorage.setItem("wwm_hide_completed", s.hideCompleted);
    if (s.enableClustering !== undefined)
      localStorage.setItem("wwm_enable_clustering", s.enableClustering);
    if (s.showAd !== undefined) localStorage.setItem("wwm_show_ad", s.showAd);
    if (s.regionColor !== undefined)
      localStorage.setItem("wwm_region_color", s.regionColor);
    if (s.regionFillColor !== undefined)
      localStorage.setItem("wwm_region_fill_color", s.regionFillColor);

    if (s.gpuMode !== undefined) {
      localStorage.setItem("wwm_gpu_setting", s.gpuMode);
      localStorage.setItem("wwm_gpu_mode", s.gpuMode);
    }

    if (s.activeCatsQinghe !== undefined)
      localStorage.setItem(
        "wwm_active_cats_qinghe",
        JSON.stringify(s.activeCatsQinghe),
      );
    if (s.activeCatsKaifeng !== undefined)
      localStorage.setItem(
        "wwm_active_cats_kaifeng",
        JSON.stringify(s.activeCatsKaifeng),
      );
    if (s.activeRegsQinghe !== undefined)
      localStorage.setItem(
        "wwm_active_regs_qinghe",
        JSON.stringify(s.activeRegsQinghe),
      );
    if (s.activeRegsKaifeng !== undefined)
      localStorage.setItem(
        "wwm_active_regs_kaifeng",
        JSON.stringify(s.activeRegsKaifeng),
      );
    if (s.favoritesQinghe !== undefined)
      localStorage.setItem(
        "wwm_favorites_qinghe",
        JSON.stringify(s.favoritesQinghe),
      );
    if (s.favoritesKaifeng !== undefined)
      localStorage.setItem(
        "wwm_favorites_kaifeng",
        JSON.stringify(s.favoritesKaifeng),
      );
    if (s.activeCatsDreamsunsun !== undefined)
      localStorage.setItem(
        "wwm_active_cats_dreamsunsun",
        JSON.stringify(s.activeCatsDreamsunsun),
      );
    if (s.activeRegsDreamsunsun !== undefined)
      localStorage.setItem(
        "wwm_active_regs_dreamsunsun",
        JSON.stringify(s.activeRegsDreamsunsun),
      );
    if (s.favoritesDreamsunsun !== undefined)
      localStorage.setItem(
        "wwm_favorites_dreamsunsun",
        JSON.stringify(s.favoritesDreamsunsun),
      );

    if (s._updatedAt)
      localStorage.setItem(
        "wwm_settings_updated_at",
        JSON.stringify(s._updatedAt),
      );
  }

  // Return result indicating what happened
  const blocked = completedBlocked || favoritesBlocked;
  return {
    success: !blocked,
    blocked,
    reason: blocked ? `Blocked: completed=${completedBlocked}, favorites=${favoritesBlocked}` : undefined
  };
};
