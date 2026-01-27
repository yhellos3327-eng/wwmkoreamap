// @ts-check
/**
 * @fileoverview Sync core module - handles data synchronization between local and cloud.
 * @module sync/core
 */

import {
  getSyncState,
  setSyncing,
  setLastSyncVersion,
  getSyncTimeout,
  setSyncTimeout,
  getPollingInterval,
  setPollingInterval,
  SYNC_DELAY,
  POLLING_INTERVAL,
} from "./state.js";
import { showSyncTooltip, hideSyncTooltip, showSyncToast } from "./ui.js";
import { getLocalData, setLocalData, getLocalDataAsync } from "./storage.js";
import { primaryDb } from "../storage/db.js";
import { isMigrated } from "../storage/migration.js";
import { mergeData, generateDataHash } from "./merge.js";
import { fetchCloudData, saveCloudData } from "./api.js";
import {
  initBroadcastChannel,
  broadcastSyncUpdate,
  closeBroadcastChannel,
} from "./broadcast.js";
import {
  connectWebSocket,
  sendSyncUpdate,
  disconnectWebSocket,
  isWebSocketConnected,
} from "./websocket.js";
import { createLogger } from "../utils/logStyles.js";

const log = createLogger("Sync");

/** @type {any} */
let authModule = null;

/**
 * Gets the auth module.
 * @returns {Promise<any>} The auth module.
 */
const getAuth = async () => {
  if (!authModule) authModule = await import("../auth.js");
  return authModule;
};

/**
 * Checks if user is logged in.
 * @returns {boolean} Whether user is logged in.
 */
const isLoggedIn = () => authModule?.isLoggedIn?.() ?? false;

/**
 * Gets the current user ID.
 * @returns {string|null} User ID or null.
 */
const getUserId = () => authModule?.getCurrentUser?.()?.id ?? null;

/**
 * Applies data to UI and local storage.
 * @param {any} data - The data to apply.
 */
const applyDataToUI = (data) => {
  setLocalData(data);
  window.dispatchEvent(new CustomEvent("syncDataLoaded", { detail: data }));
};

/**
 * Saves data to the cloud.
 * @param {boolean} [silent=false] - Whether to suppress UI feedback.
 * @param {boolean} [broadcast=true] - Whether to broadcast the update.
 * @returns {Promise<boolean>} Whether save was successful.
 */
export const saveToCloud = async (silent = false, broadcast = true) => {
  if (!isLoggedIn()) return false;
  if (getSyncState().isSyncing) return false;

  setSyncing(true);
  if (!silent) showSyncTooltip("동기화중...");

  // [Prevention] Save a local backup before pushing to cloud
  try {
    const { saveToVault } = await import("../storage/vault.js");
    await saveToVault("pre_cloud_save");
  } catch (e) {
    log.warn("Pre-save backup failed", e);
  }

  try {
    // Use async version for migrated users to get data from Vault
    let data;
    try {
      data = await getLocalDataAsync();
    } catch (e) {
      log.error("Failed to get local data for sync", e);
      throw e;
    }

    // Safety Guard: Prevent syncing empty data if we previously had data
    const prevCompletedCount = await primaryDb.get("sync_safety_prev_count");
    const currentCompletedCount = data.completedMarkers?.length || 0;

    if (prevCompletedCount !== null && prevCompletedCount !== undefined && prevCompletedCount > 0 && currentCompletedCount === 0) {
      log.warn("Safety Guard: Prevented syncing empty data over populated cloud data");
      if (!silent) showSyncToast("데이터 유실 방지: 빈 데이터 동기화가 차단되었습니다.", "error");
      return false;
    }

    // Update count for next check
    if (currentCompletedCount > 0) {
      primaryDb.set("sync_safety_prev_count", currentCompletedCount).catch(console.warn);
    }

    // SAFETY FIX: Also save to Vault (primary database) before cloud
    try {
      const { primaryDb } = await import("../storage/db.js");
      await primaryDb.setMultiple([
        { key: "completedList", value: data.completedMarkers },
        { key: "favorites", value: data.favorites },
        { key: "settings", value: data.settings }
      ]);
    } catch (e) {
      log.warn("Vault save before cloud failed", e);
    }

    await saveCloudData(data);
    setLastSyncVersion(generateDataHash(data));

    if (broadcast) {
      broadcastSyncUpdate(data);
      sendSyncUpdate(data);
    }

    if (!silent) {
      showSyncTooltip("동기화 완료!", "success");
      hideSyncTooltip(1500);
    }
    return true;
  } catch (error) {
    log.error("Save failed", error);
    if (!silent) {
      showSyncTooltip("동기화 실패", "error");
      hideSyncTooltip(2000);
    }
    return false;
  } finally {
    setSyncing(false);
  }
};

/**
 * Loads data from the cloud.
 * @param {boolean} [silent=false] - Whether to suppress UI feedback.
 * @returns {Promise<any|null>} Cloud data or null.
 */
export const loadFromCloud = async (silent = false) => {
  if (!isLoggedIn()) return null;
  if (!silent) showSyncTooltip("데이터 불러오는 중...");

  try {
    const cloudData = await fetchCloudData();
    if (cloudData) {
      if (!silent) {
        showSyncTooltip("데이터 불러오기 완료!", "success");
        hideSyncTooltip(1500);
      }
      return cloudData;
    }
    if (!silent) hideSyncTooltip(0);
    return null;
  } catch (error) {
    log.error("Load failed", error);
    if (!silent) {
      showSyncTooltip("불러오기 실패", "error");
      hideSyncTooltip(2000);
    }
    return null;
  }
};

/** @type {number} Sync lock version for optimistic locking */
let syncVersion = 0;

/**
 * Performs a full sync (merge local and cloud data).
 * SAFETY FIX: Added optimistic locking to prevent race conditions.
 * @param {boolean} [silent=false] - Whether to suppress UI feedback.
 * @param {boolean} [broadcast=true] - Whether to broadcast the update.
 * @returns {Promise<any|null>} Merged data or null.
 */
export const performFullSync = async (silent = false, broadcast = true) => {
  if (!isLoggedIn()) return null;
  if (getSyncState().isSyncing) return null;

  // SAFETY FIX: Optimistic locking - capture version at start
  const currentSyncVersion = ++syncVersion;

  setSyncing(true);

  // [Prevention] Save a local backup before full sync
  let preBackupId = null;
  try {
    const { saveToVault } = await import("../storage/vault.js");
    const result = await saveToVault("pre_full_sync");
    preBackupId = result.id;
  } catch (e) {
    log.warn("Pre-sync backup failed", e);
  }

  try {
    const cloudData = await fetchCloudData();

    // SAFETY FIX: Check if another sync started while we were fetching
    if (syncVersion !== currentSyncVersion) {
      log.warn("Race condition detected, aborting this sync");
      return null;
    }

    // Use async version for migrated users to get data from Vault
    let localData;
    try {
      localData = await getLocalDataAsync();
    } catch (e) {
      log.error("Failed to get local data for full sync", e);
      return null;
    }

    // SAFETY FIX: Validate data before merge
    const localCount = (localData.completedMarkers?.length || 0) + (localData.favorites?.length || 0);
    const cloudCount = (cloudData?.completedMarkers?.length || 0) + (cloudData?.favorites?.length || 0);

    log.info(`Data counts`, { local: localCount, cloud: cloudCount });

    const mergedData = mergeData(localData, cloudData || {});

    // SAFETY FIX: Validate merge result
    const mergedCount = (mergedData.completedMarkers?.length || 0) + (mergedData.favorites?.length || 0);
    if (mergedCount < Math.max(localCount, cloudCount) * 0.5) {
      log.error(`Merge resulted in suspicious data loss`, { local: localCount, cloud: cloudCount, merged: mergedCount });

      let rollbackStatus = "백업 없음";
      if (preBackupId) {
        try {
          const { restoreFromVault } = await import("../storage/vault.js");
          await restoreFromVault(preBackupId);
          rollbackStatus = "성공";
        } catch (e) {
          log.error("Rollback failed", e);
          rollbackStatus = `실패 (${e.message})`;
        }
      }

      showSyncToast(
        `동기화 중단: 데이터 손실 위험 감지 (병합: ${mergedCount}, 로컬: ${localCount}, 클라우드: ${cloudCount}). 롤백: ${rollbackStatus}`,
        "error"
      );
      return null;
    }

    const newHash = generateDataHash(mergedData);
    const dataChanged = newHash !== getSyncState().lastSyncVersion;

    // SAFETY FIX: Check race condition again before applying changes
    if (syncVersion !== currentSyncVersion) {
      log.warn("Race condition detected before save, aborting");
      return null;
    }

    const setResult = await setLocalData(mergedData);

    // SAFETY FIX: Also save to Vault (primary database)
    try {
      const { primaryDb } = await import("../storage/db.js");
      await primaryDb.setMultiple([
        { key: "completedList", value: mergedData.completedMarkers },
        { key: "favorites", value: mergedData.favorites },
        { key: "settings", value: mergedData.settings }
      ]);
    } catch (e) {
      log.warn("Vault save failed", e);
    }

    if (dataChanged && !setResult?.blocked) {
      await saveCloudData(mergedData);
      setLastSyncVersion(newHash);
      window.dispatchEvent(
        new CustomEvent("syncDataLoaded", { detail: mergedData }),
      );

      if (broadcast) {
        broadcastSyncUpdate(mergedData);
        sendSyncUpdate(mergedData);
      }

      if (!silent)
        showSyncToast("다른 기기의 변경사항이 동기화되었습니다", "update");
    }

    return mergedData;
  } catch (error) {
    log.error("Full sync failed", error);
    if (!silent) showSyncToast("동기화 실패: " + error.message, "error");
    return null;
  } finally {
    setSyncing(false);
  }
};

/**
 * Triggers a debounced sync.
 */
export const triggerSync = () => {
  if (!isLoggedIn()) return;
  const timeout = getSyncTimeout();
  if (timeout) clearTimeout(timeout);
  setSyncTimeout(setTimeout(() => saveToCloud(true), SYNC_DELAY));
};

/**
 * Updates a setting with timestamp tracking.
 * @param {string} key - The setting key.
 * @param {any} value - The setting value.
 */
/**
 * Updates a setting with timestamp tracking.
 * @param {string} key - The setting key.
 * @param {any} value - The setting value.
 */
export const updateSettingWithTimestamp = async (key, value) => {
  try {
    const settings = await primaryDb.get("settings") || {};
    settings[key] = value;
    await primaryDb.set("settings", settings);

    let timestamps = await primaryDb.get("settings_updated_at") || {};
    timestamps[key] = new Date().toISOString();
    await primaryDb.set("settings_updated_at", timestamps);

    triggerSync();
  } catch (e) {
    log.error("Failed to update setting", e);
  }
};

/**
 * Handles visibility change event.
 */
const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") performFullSync(true);
};

/**
 * Handles window focus event.
 */
const handleWindowFocus = () => {
  performFullSync(true);
};

/**
 * Starts polling for sync updates.
 */
const startPolling = () => {
  const existing = getPollingInterval();
  if (existing) clearInterval(existing);

  const interval = isWebSocketConnected()
    ? POLLING_INTERVAL * 3
    : POLLING_INTERVAL;

  setPollingInterval(
    setInterval(() => {
      if (document.visibilityState === "visible") performFullSync(true);
    }, interval),
  );
};

/**
 * Stops polling for sync updates.
 */
const stopPolling = () => {
  const interval = getPollingInterval();
  if (interval) {
    clearInterval(interval);
    setPollingInterval(null);
  }
};

/**
 * Handles remote data update.
 * @param {any} data - The remote data.
 */
const handleRemoteData = (data) => {
  if (!data) return;
  const currentHash = generateDataHash(getLocalData());
  const newHash = generateDataHash(data);

  if (currentHash !== newHash) {
    applyDataToUI(data);
    setLastSyncVersion(newHash);
    showSyncToast("다른 기기에서 변경사항이 동기화되었습니다", "update");
  }
};

/**
 * Handles broadcast data update.
 * @param {any} data - The broadcast data.
 */
const handleBroadcastData = (data) => {
  if (!data) return;
  const currentHash = generateDataHash(getLocalData());
  const newHash = generateDataHash(data);

  if (currentHash !== newHash) {
    applyDataToUI(data);
    setLastSyncVersion(newHash);
    showSyncToast("다른 탭에서 변경사항이 동기화되었습니다", "update");
  }
};

/**
 * Sets up real-time sync listeners.
 */
const setupRealtimeSync = () => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleWindowFocus);
  initBroadcastChannel(handleBroadcastData);

  const userId = getUserId();
  if (userId) connectWebSocket(userId, handleRemoteData);

  startPolling();
};

/**
 * Cleans up real-time sync listeners.
 */
export const cleanupRealtimeSync = () => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("focus", handleWindowFocus);
  closeBroadcastChannel();
  disconnectWebSocket();
  stopPolling();
};

/**
 * Initializes the sync system.
 * @returns {Promise<void>}
 */
export const initSync = async () => {
  await getAuth();

  // [Prevention] Auto-restore from Vault if LocalStorage is empty before starting sync
  try {
    const { autoRestoreIfEmpty } = await import("../storage/vault.js");
    const restoreResult = await autoRestoreIfEmpty();
    if (restoreResult.restored) {
      log.success("LocalStorage was empty, restored from latest Vault backup");
      showSyncToast("로컬 데이터가 비어있어 최신 백업에서 복구되었습니다.", "success");
    }
  } catch (e) {
    log.error("Auto-restore check failed", e);
  }

  if (!isLoggedIn()) return;

  const { primaryDb } = await import("../storage/db.js");
  const backupRestoredFlag = await primaryDb.get("wwm_backup_restored");
  if (backupRestoredFlag) {
    await primaryDb.delete("wwm_backup_restored");

    log.info("Backup restore detected, pushing local data to cloud...");
    showSyncTooltip("백업 데이터 동기화 중...");

    try {
      const saved = await saveToCloud(true, true);
      if (saved) {
        showSyncTooltip("백업 데이터 동기화 완료!", "success");
        hideSyncTooltip(1500);
      } else {
        showSyncTooltip("동기화 실패", "error");
        hideSyncTooltip(2000);
      }
    } catch (error) {
      log.error("Backup sync failed", error);
      showSyncTooltip("동기화 실패", "error");
      hideSyncTooltip(2000);
    }

    setupRealtimeSync();
    return;
  }

  // showSyncTooltip("데이터 동기화 중...");

  try {
    const mergedData = await performFullSync(true, false);
    if (mergedData) {
      window.dispatchEvent(
        new CustomEvent("syncDataLoaded", { detail: mergedData }),
      );
      // showSyncTooltip("동기화 완료!", "success");
      // hideSyncTooltip(1500);
    } else {
      // hideSyncTooltip(0);
    }
    setupRealtimeSync();
  } catch (error) {
    log.error("Init failed", error);
    showSyncTooltip("동기화 실패", "error");
    hideSyncTooltip(2000);
  }
};

export { mergeData } from "./merge.js";
export { getLocalData, setLocalData } from "./storage.js";
