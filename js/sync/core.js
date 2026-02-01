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
  setInitialSyncComplete,
  setServerDataVersion,
  SYNC_DELAY,
  POLLING_INTERVAL,
} from "./state.js";
import { showSyncTooltip, hideSyncTooltip, showSyncToast, showDataLossWarning } from "./ui.js";
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
 * @param {string} [source='internal'] - The source of the data ('internal' or 'external').
 */
const applyDataToUI = (data, source = 'internal') => {
  setLocalData(data);
  // Add source to event detail so handlers can distinguish
  window.dispatchEvent(new CustomEvent("syncDataLoaded", { detail: { ...data, _source: source } }));
};

/**
 * Saves data to the cloud.
 * @param {boolean} [silent=false] - Whether to suppress UI feedback.
 * @param {boolean} [broadcast=true] - Whether to broadcast the update.
 * @param {boolean} [force=false] - Whether to force save even if guards block it.
 * @returns {Promise<boolean>} Whether save was successful.
 */
export const saveToCloud = async (silent = false, broadcast = true, force = false) => {
  if (!isLoggedIn()) return false;
  if (getSyncState().isSyncing) return false;

  // GUARD 1: Require initial sync completion
  if (!getSyncState().isInitialSyncComplete && !force) {
    log.warn("BLOCKED: Initial sync not complete. Save aborted.");
    if (!silent) showSyncToast("초기 동기화 전에는 저장할 수 없습니다.", "error");
    return false;
  }

  // SAFETY FIX: Optimistic locking - capture version at start
  const currentSyncVersion = syncVersion;

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

    if (prevCompletedCount !== null && prevCompletedCount !== undefined && prevCompletedCount > 0 && currentCompletedCount === 0 && !force) {
      log.warn("Safety Guard: Prevented syncing empty data over populated cloud data");
      if (!silent) showSyncToast("데이터 유실 방지: 빈 데이터 동기화가 차단되었습니다.", "error");
      return false;
    }

    // GUARD 2: Massive Data Loss Protection
    // Check cloud count before overwriting
    try {
      const cloudResult = await fetchCloudData();
      const cloudDataSnapshot = cloudResult.data;
      const cloudCount = (cloudDataSnapshot?.completedMarkers?.length || 0) + (cloudDataSnapshot?.favorites?.length || 0);
      const localCount = (data.completedMarkers?.length || 0) + (data.favorites?.length || 0);
      const threshold = 10; // Allow small variations

      // If Cloud has significantly more data than Local, and we are not forcing
      if (cloudCount > localCount + threshold && !force) {
        log.error(`BLOCKED: Massive Data Loss Protection. Cloud: ${cloudCount}, Local: ${localCount}`);
        if (!silent) showSyncToast(`서버 데이터(${cloudCount}개)가 더 많아 덮어쓰기가 차단되었습니다.`, "error");

        // Trigger a re-sync instead
        log.info("Triggering re-sync to resolve conflict...");
        performFullSync(false, true);
        return false;
      }
    } catch (e) {
      log.warn("Failed to check cloud data count, proceeding with caution", e);
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

    // RACE CONDITION CHECK
    if (syncVersion !== currentSyncVersion) {
      log.warn("Race condition detected before save, aborting");
      if (!silent) showSyncToast("동기화 충돌: 다시 시도해주세요.", "error");
      return false;
    }

    // OPTIMISTIC LOCKING: Send Expected Version
    const expectedVersion = getSyncState().serverDataVersion;
    const saveResult = await saveCloudData(data, expectedVersion);

    // Update local version tracking on success
    if (saveResult.version) {
      setServerDataVersion(saveResult.version);
    }

    setLastSyncVersion(generateDataHash(data));

    if (broadcast) {
      broadcastSyncUpdate(data);
      sendSyncUpdate(data);
    }

    if (!silent) {
      showSyncTooltip("동기화 완료!", "success");
      hideSyncTooltip(1500);
    }

    // Update Base Snapshot
    primaryDb.set("sync_base_snapshot", data).catch(console.warn);

    return true;
  } catch (error) {
    // Handle Version Conflict
    if (error.name === "VersionConflictError") {
      log.warn("Optimistic Locking: Version Conflict detected", error);
      if (!silent) showSyncToast("다른 기기에서 변경사항이 감지되었습니다. 병합 중...", "warning");

      // Auto-resolve: Trigger Full Sync (Merge)
      // Assuming timeoutPromise is available or defined elsewhere
      const timeoutPromise = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      timeoutPromise(100).then(() => performFullSync(silent, broadcast));
      return false;
    }

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
    const { data: cloudData, version } = await fetchCloudData();

    // Track version
    setServerDataVersion(version);

    if (cloudData) {
      if (!silent) {
        showSyncTooltip("데이터 불러오기 완료!", "success");
        hideSyncTooltip(1500);
      }
      // Update Base Snapshot
      primaryDb.set("sync_base_snapshot", cloudData).catch(console.warn);
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
    const { data: cloudData, version } = await fetchCloudData();

    // Capture Server Version
    if (version) {
      setServerDataVersion(version);
    }

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

    // Load Base Snapshot for 3-Way Merge
    let baseData = {};
    try {
      baseData = (await primaryDb.get("sync_base_snapshot")) || {};
    } catch (e) {
      log.warn("Failed to load base snapshot, defaulting to empty", e);
    }

    // CORRECTION: If Base is empty (First run), treat Cloud as Base.
    // This allows the 3-Way Merge to correctly identify "Local Deletions".
    // (If Base is empty, !Local && Cloud means "New Remote Item", so it reappears.
    //  If Base == Cloud, !Local && Cloud && Base means "Deleted Locally", so it stays deleted.)
    if ((!baseData.completedMarkers || baseData.completedMarkers.length === 0) && cloudData && cloudData.completedMarkers) {
      log.info("Base snapshot missing or empty. Initializing Base from Cloud Data for accurate differential merge.");
      baseData = JSON.parse(JSON.stringify(cloudData));
    }

    // SAFETY FIX: Validate data before merge
    const localCount = (localData.completedMarkers?.length || 0) + (localData.favorites?.length || 0);
    const cloudCount = (cloudData?.completedMarkers?.length || 0) + (cloudData?.favorites?.length || 0);
    const baseCount = (baseData.completedMarkers?.length || 0) + (baseData.favorites?.length || 0);

    // GUARD: Sudden Local Data Loss
    if (baseCount > 5 && localCount === 0 && cloudCount > 0) {
      log.warn("Potential data loss detected through empty local state.");

      if (silent) {
        // In silent mode (background), we play safe and abort
        log.warn("Background sync aborted to protect data.");
        return null;
      }

      // Ask user
      const choice = await showDataLossWarning(localCount, cloudCount);

      if (choice === 'cancel') {
        return null;
      }

      if (choice === 'restore') {
        log.info("User chose to RESTORE from cloud.");
        // Force load from cloud
        await loadFromCloud();
        return null;
      }

      log.info("User confirmed INTENTIONAL DELETION. Proceeding with merge.");
      // Fall through to 3-way merge, which will respect the deletions because Local is empty 
      // and Base has data => Logic will see (In Base, !Local) -> Deleted.
    }

    log.info(`Data counts`, { local: localCount, cloud: cloudCount });

    // CLOUD PRIORITY CHECK: If Cloud has much more data, we explicitly trust it.
    // (Disable this if we trust 3-way merge, but keep as failsafe for massive discrepancies)
    if (cloudCount > localCount + 50) {
      log.info("Cloud data is significantly larger. Prioritizing Cloud merge.");
    }

    // 3-Way Merge
    const mergedData = mergeData(localData, cloudData || {}, baseData);

    // Update Snapshot after successful merge
    primaryDb.set("sync_base_snapshot", mergedData).catch(e => log.warn("Failed to update snapshot", e));

    // SAFETY FIX: Validate merge result
    const mergedCount = (mergedData.completedMarkers?.length || 0) + (mergedData.favorites?.length || 0);

    // Only block if we had significant local data that disappeared
    // If local was small, it's okay for merged < max * 0.5 because merged will be >= cloud anyway.
    // The dangerous case is: Local(1000) + Cloud(10) -> Merged(500) [Loss of 500]
    // The case we WANT: Local(5) + Cloud(1000) -> Merged(1005) [Gain]
    const maxSourceCount = Math.max(localCount, cloudCount);

    if (maxSourceCount > 10 && mergedCount < maxSourceCount * 0.5) {
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
      // NOTE: We pass 'true' for force here because we just performed a merge, so it's safe to overwrite cloud.
      // We also pass the captured server version to satisfy optimistic locking
      const saveResult = await saveCloudData(mergedData, version);
      if (saveResult && saveResult.version) {
        setServerDataVersion(saveResult.version);
      }

      setLastSyncVersion(newHash);
      window.dispatchEvent(
        new CustomEvent("syncDataLoaded", { detail: mergedData }),
      );

      if (broadcast) {
        // Send versioned payload to prevent stale data overwrites
        const payload = { ...mergedData, version: saveResult?.version };
        broadcastSyncUpdate(payload);
        sendSyncUpdate(payload);
      }

      if (!silent)
        showSyncToast("다른 기기의 변경사항이 동기화되었습니다", "update");
    }

    // MARK SUCCESS: Initial sync is complete
    setInitialSyncComplete(true);

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
    const setResult = await primaryDb.set("settings", settings);
    if (!setResult || !setResult.success) {
      throw new Error(`Failed to save settings: ${setResult?.error || 'Unknown error'}`);
    }

    let timestamps = await primaryDb.get("settings_updated_at") || {};
    timestamps[key] = new Date().toISOString();
    const timeResult = await primaryDb.set("settings_updated_at", timestamps);
    if (!timeResult || !timeResult.success) {
      log.warn("Failed to save setting timestamp", timeResult?.error);
    }

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
/**
const handleRemoteData = (data) => {
  if (!data) return;
  
  // GUARD: Ignore external updates if we are currently syncing to prevent conflicts/overwrites
  if (getSyncState().isSyncing) {
    log.info("Ignoring remote update because sync is in progress.");
    return;
  }

  // GUARD: Version Check (Stale Data Prevention)
  // If the incoming data is not newer than what we have, ignore it.
  const currentVer = getSyncState().serverDataVersion;
  if (data.version && data.version <= currentVer) {
    // log.info(`Ignoring stale remote update (v${data.version} <= v${currentVer})`);
    return;
  }

  const newHash = generateDataHash(data);

  // Ignore if this is the same version we just synced
  if (newHash === getSyncState().lastSyncVersion) return;

  const currentHash = generateDataHash(getLocalData());
  if (currentHash !== newHash) {
    applyDataToUI(data, 'external');
    setLastSyncVersion(newHash);
    
    // Update server version to the new one
    if (data.version) setServerDataVersion(data.version);
    
    showSyncToast("다른 기기에서 변경사항이 동기화되었습니다", "update");
  }
};

/**
 * Handles broadcast data update.
 * @param {any} data - The broadcast data.
 */
const handleBroadcastData = (data) => {
  if (!data) return;

  // GUARD: Ignore external updates if we are currently syncing
  if (getSyncState().isSyncing) {
    log.info("Ignoring broadcast update because sync is in progress.");
    return;
  }

  // GUARD: Version Check
  const currentVer = getSyncState().serverDataVersion;
  if (data.version && data.version <= currentVer) {
    return;
  }

  const newHash = generateDataHash(data);

  // Ignore if this is the same version we just synced
  if (newHash === getSyncState().lastSyncVersion) return;

  const currentHash = generateDataHash(getLocalData());
  if (currentHash !== newHash) {
    applyDataToUI(data, 'external');
    setLastSyncVersion(newHash);
    if (data.version) setServerDataVersion(data.version);
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

  showSyncTooltip("데이터 동기화 중...");

  try {
    const mergedData = await performFullSync(true, false);
    if (mergedData) {
      window.dispatchEvent(
        new CustomEvent("syncDataLoaded", { detail: mergedData }),
      );
      showSyncTooltip("동기화 완료!", "success");
      hideSyncTooltip(1500);
      setInitialSyncComplete(true);
    } else {
      hideSyncTooltip(0);
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
