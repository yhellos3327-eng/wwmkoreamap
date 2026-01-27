// @ts-check
/**
 * @deprecated This module is deprecated. Use Vault (IndexedDB) via storage/db.js instead.
 */
console.warn("[Storage:index] This module is deprecated. Use Vault (IndexedDB) instead.");

import { core, encoded, transaction } from "./core.js";
import {
  SCHEMA,
  getSchema,
  validateValue,
  getCurrentSnapshotKeys,
  transformForSave,
} from "./schema.js";
import {
  saveSnapshot,
  getSnapshot,
  getSnapshotInfo,
  hasSnapshot,
  restoreFromSnapshot,
  clearSnapshot,
  logFailure,
  getFailureLogs,
  clearFailureLogs,
  debouncedSave,
} from "./snapshot.js";

/**
 * Storage keys used in the application.
 */
export const STORAGE_KEYS = {
  COMPLETED: "wwm_completed",
  FAVORITES: "wwm_favorites",
  SHOW_COMMENTS: "wwm_show_comments",
  CLOSE_ON_COMPLETE: "wwm_close_on_complete",
  AI_PROVIDER: "wwm_ai_provider",
  API_KEY: "wwm_api_key",
  OPENAI_KEY: "wwm_openai_key",
  CLAUDE_KEY: "wwm_claude_key",
  API_MODEL: "wwm_api_model",
  REGION_COLOR: "wwm_region_color",
  REGION_FILL_COLOR: "wwm_region_fill_color",
  HIDE_COMPLETED: "wwm_hide_completed",
  ENABLE_CLUSTERING: "wwm_enable_clustering",
  SHOW_AD: "wwm_show_ad",

  CLEANUP_LAST_RUN: "wwm_cleanup_last_run",
  LAST_KNOWN_GOOD: "wwm_last_known_good",
  RESTORE_FAILURE_LOG: "wwm_restore_failure_log",
  DATA_VERSION: "wwm_data_version",

  /** @param {string} mapKey */
  activeCats: (mapKey) => `wwm_active_cats_${mapKey}`,
  /** @param {string} mapKey */
  activeRegs: (mapKey) => `wwm_active_regs_${mapKey}`,
  /** @param {string} mapKey */
  favorites: (mapKey) => `wwm_favorites_${mapKey}`,
  /** @param {number|string} noticeId */
  noticeHidden: (noticeId) => `wwm_notice_hidden_${noticeId}`,
};

export const storage = {
  get: core.get,
  getJSON: core.getJSON,
  set: (key, value) => core.set(key, value).success,
  setJSON: (key, value) => core.setJSON(key, value).success,
  remove: (key) => core.remove(key).success,

  /**
   * Gets a boolean value from storage.
   * @param {string} key - The storage key.
   * @param {boolean} [defaultValue=false] - Default value if not found.
   * @returns {boolean} The boolean value.
   */
  getBool: (key, defaultValue = false) => {
    const v = core.get(key, null);
    return v === null ? defaultValue : v === "true";
  },

  /**
   * Gets a boolean value from storage (inverse logic).
   * @param {string} key - The storage key.
   * @param {boolean} [defaultValue=true] - Default value if not found.
   * @returns {boolean} The boolean value.
   */
  getBoolInverse: (key, defaultValue = true) => {
    const v = core.get(key, null);
    return v === null ? defaultValue : v !== "false";
  },

  encodeApiKey: encoded.encode,
  decodeApiKey: encoded.decode,
  setApiKey: (key, value) => encoded.set(key, value).success,
  getApiKey: encoded.get,
};

/**
 * Safely saves a value to storage with validation.
 * @param {string} key - The storage key.
 * @param {any} value - The value to save.
 * @param {boolean} [isJSON=true] - Whether to save as JSON.
 * @returns {boolean} True if successful.
 */
const safeSave = (key, value, isJSON = true) => {
  const transformed = transformForSave(key, value);

  const validation = validateValue(key, transformed);
  if (!validation.valid && !validation.unknown) {
    console.warn(`[Storage] Validation failed for ${key}:`, validation.message);
    return false;
  }

  const result = isJSON
    ? core.setJSON(key, transformed)
    : core.set(key, transformed);

  const schema = getSchema(key);
  if (result.success && schema?.snapshot) {
    debouncedSave();
  }

  return result.success;
};

export const persistState = {
  saveCompleted: (list) => {
    if (!Array.isArray(list)) return false;
    return safeSave(STORAGE_KEYS.COMPLETED, list);
  },
  loadCompleted: () => core.getJSON(STORAGE_KEYS.COMPLETED, []),

  saveFavorites: (list) => {
    if (!Array.isArray(list)) return false;
    return safeSave(STORAGE_KEYS.FAVORITES, list);
  },
  loadFavorites: () => core.getJSON(STORAGE_KEYS.FAVORITES, []),

  saveFavoritesForMap: (mapKey, list) => {
    if (!Array.isArray(list)) return false;
    return safeSave(STORAGE_KEYS.favorites(mapKey), list);
  },
  loadFavoritesForMap: (mapKey) =>
    core.getJSON(STORAGE_KEYS.favorites(mapKey), []),

  saveActiveCats: (mapKey, ids) => {
    const arr = Array.isArray(ids) ? ids : [...ids];
    return safeSave(STORAGE_KEYS.activeCats(mapKey), arr.map(String));
  },
  loadActiveCats: (mapKey) => core.getJSON(STORAGE_KEYS.activeCats(mapKey), []),

  saveActiveRegs: (mapKey, names) => {
    const arr = Array.isArray(names) ? names : [...names];
    return safeSave(STORAGE_KEYS.activeRegs(mapKey), arr);
  },
  loadActiveRegs: (mapKey) => core.getJSON(STORAGE_KEYS.activeRegs(mapKey), []),

  saveSettings: (settings) => {
    if (settings.aiProvider !== undefined)
      core.set(STORAGE_KEYS.AI_PROVIDER, settings.aiProvider);
    if (settings.apiKey !== undefined)
      encoded.set(STORAGE_KEYS.API_KEY, settings.apiKey);
    if (settings.openaiKey !== undefined)
      encoded.set(STORAGE_KEYS.OPENAI_KEY, settings.openaiKey);
    if (settings.claudeKey !== undefined)
      encoded.set(STORAGE_KEYS.CLAUDE_KEY, settings.claudeKey);
    if (settings.apiModel !== undefined)
      core.set(STORAGE_KEYS.API_MODEL, settings.apiModel);
    if (settings.regionColor !== undefined)
      core.set(STORAGE_KEYS.REGION_COLOR, settings.regionColor);
    if (settings.regionFillColor !== undefined)
      core.set(STORAGE_KEYS.REGION_FILL_COLOR, settings.regionFillColor);
    if (settings.hideCompleted !== undefined)
      core.set(STORAGE_KEYS.HIDE_COMPLETED, settings.hideCompleted);
    if (settings.enableClustering !== undefined)
      core.set(STORAGE_KEYS.ENABLE_CLUSTERING, settings.enableClustering);
    if (settings.showComments !== undefined)
      core.set(STORAGE_KEYS.SHOW_COMMENTS, settings.showComments);
    if (settings.closeOnComplete !== undefined)
      core.set(STORAGE_KEYS.CLOSE_ON_COMPLETE, settings.closeOnComplete);
    if (settings.showAd !== undefined)
      core.set(STORAGE_KEYS.SHOW_AD, settings.showAd);
  },

  loadSettings: () => ({
    aiProvider: core.get(STORAGE_KEYS.AI_PROVIDER, "gemini"),
    apiKey: encoded.get(STORAGE_KEYS.API_KEY, ""),
    openaiKey: encoded.get(STORAGE_KEYS.OPENAI_KEY, ""),
    claudeKey: encoded.get(STORAGE_KEYS.CLAUDE_KEY, ""),
    apiModel: core.get(STORAGE_KEYS.API_MODEL, "gemini-1.5-flash"),
    regionColor: core.get(STORAGE_KEYS.REGION_COLOR, "#242424"),
    regionFillColor: core.get(STORAGE_KEYS.REGION_FILL_COLOR, "#ffbd53"),
    hideCompleted: storage.getBool(STORAGE_KEYS.HIDE_COMPLETED, false),
    enableClustering: storage.getBoolInverse(
      STORAGE_KEYS.ENABLE_CLUSTERING,
      true,
    ),
    showComments: storage.getBoolInverse(STORAGE_KEYS.SHOW_COMMENTS, true),
    closeOnComplete: storage.getBool(STORAGE_KEYS.CLOSE_ON_COMPLETE, false),
    showAd: storage.getBoolInverse(STORAGE_KEYS.SHOW_AD, true),
  }),
};

export const restoreUtils = {
  tryRestoreFromLastGood: () => restoreFromSnapshot().success,
  hasLastKnownGood: hasSnapshot,
  getLastKnownGoodInfo: getSnapshotInfo,
  getFailureLogs,
  clearFailureLogs,
  logFailure,
  saveSnapshot,
  clearSnapshot,
};

/**
 * Restores state from a data object safely.
 * @param {any} data - The data to restore.
 * @param {function(): void} [onSuccess] - Callback on success.
 * @param {function(any): void} [onError] - Callback on error.
 * @returns {{success: boolean, fallbackApplied?: boolean, error?: string}} Result object.
 */
export const safeRestore = (data, onSuccess, onError) => {
  try {
    if (!data || typeof data !== "object") {
      throw new Error("유효하지 않은 데이터 형식");
    }

    if (data.completedMarkers && Array.isArray(data.completedMarkers)) {
      if (!persistState.saveCompleted(data.completedMarkers)) {
        throw new Error("완료 목록 저장 실패");
      }
    }

    if (data.favorites && Array.isArray(data.favorites)) {
      if (!persistState.saveFavorites(data.favorites)) {
        throw new Error("즐겨찾기 저장 실패");
      }
    }

    if (data.settings && typeof data.settings === "object") {
      for (const [key, value] of Object.entries(data.settings)) {
        if (key.startsWith("activeCats") && Array.isArray(value)) {
          const mapKey =
            key.replace("activeCats", "").toLowerCase() || "qinghe";
          persistState.saveActiveCats(mapKey, value);
        } else if (key.startsWith("activeRegs") && Array.isArray(value)) {
          const mapKey =
            key.replace("activeRegs", "").toLowerCase() || "qinghe";
          persistState.saveActiveRegs(mapKey, value);
        }
      }
      persistState.saveSettings(data.settings);
    }

    saveSnapshot();

    if (onSuccess) onSuccess();
    return { success: true };
  } catch (error) {
    console.error("[Storage] Restore failed:", error);
    logFailure(error.message, { dataKeys: Object.keys(data || {}) });

    if (hasSnapshot()) {
      const fallbackResult = restoreFromSnapshot();
      if (fallbackResult.success) {
        if (onError) {
          onError({
            error: error.message,
            fallbackApplied: true,
            message: "복원 실패 - 마지막 정상 상태로 복구됨",
          });
        }
        return { success: false, fallbackApplied: true, error: error.message };
      }
    }

    if (onError) {
      onError({
        error: error.message,
        fallbackApplied: false,
        message: "복원 실패",
      });
    }
    return { success: false, fallbackApplied: false, error: error.message };
  }
};

export const initStorageSnapshot = () => {
  const completed = core.getJSON(STORAGE_KEYS.COMPLETED, null);
  const favorites = core.getJSON(STORAGE_KEYS.FAVORITES, null);

  if (completed !== null || favorites !== null) {
    saveSnapshot();
    console.log("[Storage] Initial snapshot saved");
  }
};

export {
  core,
  encoded,
  transaction,
  SCHEMA,
  getSchema,
  validateValue,
  getCurrentSnapshotKeys,
  saveSnapshot,
  getSnapshot,
  getSnapshotInfo,
  hasSnapshot,
  restoreFromSnapshot,
  clearSnapshot,
  debouncedSave,
};
