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
import { getLocalData, setLocalData } from "./storage.js";
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

  try {
    const data = getLocalData();
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
    console.error("[Sync] Save failed:", error);
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
    console.error("[Sync] Load failed:", error);
    if (!silent) {
      showSyncTooltip("불러오기 실패", "error");
      hideSyncTooltip(2000);
    }
    return null;
  }
};

/**
 * Performs a full sync (merge local and cloud data).
 * @param {boolean} [silent=false] - Whether to suppress UI feedback.
 * @param {boolean} [broadcast=true] - Whether to broadcast the update.
 * @returns {Promise<any|null>} Merged data or null.
 */
export const performFullSync = async (silent = false, broadcast = true) => {
  if (!isLoggedIn()) return null;
  if (getSyncState().isSyncing) return null;

  setSyncing(true);

  try {
    const cloudData = await fetchCloudData();
    const localData = getLocalData();
    const mergedData = mergeData(localData, cloudData || {});
    const newHash = generateDataHash(mergedData);
    const dataChanged = newHash !== getSyncState().lastSyncVersion;

    setLocalData(mergedData);

    if (dataChanged) {
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
    console.error("[Sync] Full sync failed:", error);
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
  setSyncTimeout(setTimeout(() => saveToCloud(), SYNC_DELAY));
};

/**
 * Updates a setting with timestamp tracking.
 * @param {string} key - The setting key.
 * @param {any} value - The setting value.
 */
export const updateSettingWithTimestamp = (key, value) => {
  localStorage.setItem(`wwm_${key}`, value);

  let timestamps = {};
  const stored = localStorage.getItem("wwm_settings_updated_at");
  if (stored) {
    try {
      timestamps = JSON.parse(stored);
    } catch (e) {}
  }

  timestamps[key] = new Date().toISOString();
  localStorage.setItem("wwm_settings_updated_at", JSON.stringify(timestamps));
  triggerSync();
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
  if (!isLoggedIn()) return;

  const backupRestoredFlag = localStorage.getItem("wwm_backup_restored");
  if (backupRestoredFlag) {
    localStorage.removeItem("wwm_backup_restored");

    console.log(
      "[Sync] Backup restore detected, pushing local data to cloud...",
    );
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
      console.error("[Sync] Backup sync failed:", error);
      showSyncTooltip("동기화 실패", "error");
      hideSyncTooltip(2000);
    }

    setupRealtimeSync();
    return;
  }

  showSyncTooltip("데이터 동기화 중...");

  try {
    const mergedData = await performFullSync(true, false);
    if (mergedData) {
      window.dispatchEvent(
        new CustomEvent("syncDataLoaded", { detail: mergedData }),
      );
      showSyncTooltip("동기화 완료!", "success");
      hideSyncTooltip(1500);
    } else {
      hideSyncTooltip(0);
    }
    setupRealtimeSync();
  } catch (error) {
    console.error("[Sync] Init failed:", error);
    showSyncTooltip("동기화 실패", "error");
    hideSyncTooltip(2000);
  }
};

export { mergeData } from "./merge.js";
export { getLocalData, setLocalData } from "./storage.js";
