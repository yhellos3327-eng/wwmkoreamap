// @ts-check
/**
 * @fileoverview Sync storage module - Dexie.js (IndexedDB) as single source of truth.
 * DEXIE.JS MIGRATION: localStorage dependencies removed, Vault only.
 */

import { primaryDb } from "../storage/db.js";
import { createLogger } from "../utils/logStyles.js";

const log = createLogger("Storage");

/**
 * @typedef {Object} SyncData
 * @property {any[]} completedMarkers - Completed markers array.
 * @property {any[]} favorites - Favorites array.
 * @property {any} settings - Settings object.
 */

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
 * Gets local data from Vault (Dexie.js).
 * DEXIE.JS MIGRATION: Now returns cached data or empty arrays.
 * For async access, use getLocalDataAsync() instead.
 * @returns {SyncData} The local data (may be empty if not yet loaded).
 */
export const getLocalData = () => {
  // DEXIE.JS MIGRATION: This synchronous function now returns state data
  // which is already loaded from Vault via initStateFromVault()
  try {
    // Use global state if available (set in state.js/debug.js)
    const state = /** @type {any} */ (window).state;
    if (!state) {
      log.warn("Global state not ready, returning empty data");
      return { completedMarkers: [], favorites: [], settings: {} };
    }

    return {
      completedMarkers: state.completedList || [],
      favorites: state.favorites || [],
      settings: getSettingsFromState(state)
    };
  } catch (e) {
    log.warn("getLocalData fallback to empty", e);
    return { completedMarkers: [], favorites: [], settings: {} };
  }
};

/**
 * Gets settings from current state.
 * @param {any} state - The app state.
 * @returns {Object} The settings object.
 */
const getSettingsFromState = (state) => {
  return {
    showComments: state.showComments ?? true,
    closeOnComplete: state.closeOnComplete ?? false,
    hideCompleted: state.hideCompleted ?? false,
    enableClustering: state.enableClustering ?? true,
    regionColor: state.savedRegionColor,
    regionFillColor: state.savedRegionFillColor,
    gpuMode: state.savedGpuSetting,
    aiProvider: state.savedAIProvider,
    apiModel: state.savedApiModel,
    menuPosition: state.savedMenuPosition,
    useChromeTranslator: state.useChromeTranslator,
    disableRegionClickPan: state.disableRegionClickPan,
  };
};

/**
 * Sets local data to Vault (Dexie.js).
 * DEXIE.JS MIGRATION: Always uses async Vault save.
 * @param {SyncData} data - The data to save.
 * @returns {SetLocalDataResult} The result of the operation.
 */
export const setLocalData = (data) => {
  if (!data) return { success: false, blocked: false, reason: "No data provided" };

  // DEXIE.JS MIGRATION: Always use async Vault save
  setLocalDataAsync(data).catch(e => {
    log.error("Vault save failed", e);
  });

  return { success: true, blocked: false };
};

// ============================================================================
// ASYNC VAULT FUNCTIONS - Dexie.js as single source of truth
// ============================================================================

/**
 * Gets local data asynchronously from Vault (Dexie.js).
 * This is the primary method for data access.
 * @returns {Promise<SyncData>} The local data.
 */
export const getLocalDataAsync = async () => {
  try {
    const completedMarkers = await primaryDb.get("completedList") || [];
    const favorites = await primaryDb.get("favorites") || [];
    const settings = await primaryDb.get("settings") || {};

    return { completedMarkers, favorites, settings };
  } catch (e) {
    log.error("getLocalDataAsync failed", e);
    return { completedMarkers: [], favorites: [], settings: {} };
  }
};

/**
 * Sets local data asynchronously to Vault (Dexie.js).
 * @param {SyncData} data - The data to save.
 * @returns {Promise<SetLocalDataResult>} The result of the operation.
 */
export const setLocalDataAsync = async (data) => {
  if (!data) return { success: false, blocked: false, reason: "No data provided" };

  try {
    const entries = [];
    let completedBlocked = false;
    let favoritesBlocked = false;

    // Handle completedMarkers with safety guard
    if (data.completedMarkers !== undefined) {
      const currentCompleted = await primaryDb.get("completedList") || [];
      const currentCount = Array.isArray(currentCompleted) ? currentCompleted.length : 0;
      const newCount = Array.isArray(data.completedMarkers) ? data.completedMarkers.length : 0;

      // SAFETY: Block suspicious data loss
      if (currentCount > SAFETY_CONFIG.MIN_COMPLETED_THRESHOLD) {
        if (newCount === 0) {
          log.error(`BLOCKED: Attempt to overwrite ${currentCount} completed items with empty array`);
          completedBlocked = true;
        } else if (newCount < currentCount * SAFETY_CONFIG.MAX_LOSS_RATIO) {
          log.error(`BLOCKED: Suspicious data loss detected. ${currentCount} → ${newCount}`);
          completedBlocked = true;
        }
      }

      if (!completedBlocked) {
        entries.push({ key: "completedList", value: data.completedMarkers });
      }
    }

    // Handle favorites with safety guard
    if (data.favorites !== undefined) {
      const currentFavorites = await primaryDb.get("favorites") || [];
      const currentCount = Array.isArray(currentFavorites) ? currentFavorites.length : 0;
      const newCount = Array.isArray(data.favorites) ? data.favorites.length : 0;

      if (currentCount > SAFETY_CONFIG.MIN_FAVORITES_THRESHOLD) {
        if (newCount === 0) {
          log.error(`BLOCKED: Attempt to overwrite ${currentCount} favorites with empty array`);
          favoritesBlocked = true;
        } else if (newCount < currentCount * SAFETY_CONFIG.MAX_LOSS_RATIO) {
          log.error(`BLOCKED: Suspicious favorites loss. ${currentCount} → ${newCount}`);
          favoritesBlocked = true;
        }
      }

      if (!favoritesBlocked) {
        entries.push({ key: "favorites", value: data.favorites });
      }
    }

    // Handle settings
    if (data.settings) {
      entries.push({ key: "settings", value: data.settings });
    }

    // Save to Vault
    if (entries.length > 0) {
      const result = await primaryDb.setMultiple(entries);
      if (!result.success) {
        return { success: false, blocked: false, reason: result.error };
      }
    }

    const blocked = completedBlocked || favoritesBlocked;
    return {
      success: !blocked,
      blocked,
      reason: blocked ? `Blocked: completed=${completedBlocked}, favorites=${favoritesBlocked}` : undefined
    };
  } catch (e) {
    log.error("setLocalDataAsync failed", e);
    return { success: false, blocked: false, reason: e.message };
  }
};
