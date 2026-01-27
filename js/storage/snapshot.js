// @ts-check
import { getCurrentSnapshotKeys, getSchema } from "./schema.js";

/** @type {string} */
const SNAPSHOT_KEY = "wwm_last_known_good";

/** @type {string} */
const FAILURE_LOG_KEY = "wwm_restore_failure_log";

/** @type {number} */
const MAX_FAILURE_LOGS = 10;

/** @type {number} */
const MAX_SNAPSHOT_SIZE = 1024 * 1024;

/**
 * Saves a snapshot of current localStorage state.
 * @param {{keys?: string[]}} [options] - Snapshot options.
 * @returns {Promise<{success: boolean, size?: number, keyCount?: number, error?: string}>} Result.
 */
export const saveSnapshot = async (options = {}) => {
  try {
    const { primaryDb } = await import("./db.js");
    // We export everything for the snapshot
    const exportData = await primaryDb.exportAll();

    const snapshot = {
      version: 1,
      timestamp: Date.now(),
      keys: exportData.data, // This matches the structure expected by importAll
    };

    const snapshotStr = JSON.stringify(snapshot);

    if (snapshotStr.length > MAX_SNAPSHOT_SIZE) {
      console.warn("[Snapshot] Snapshot too large:", snapshotStr.length);
      return {
        success: false,
        error: "Snapshot exceeds size limit",
        size: snapshotStr.length,
      };
    }

    await primaryDb.set(SNAPSHOT_KEY, snapshot);

    return {
      success: true,
      size: snapshotStr.length,
      keyCount: Object.keys(snapshot.keys).length,
    };
  } catch (e) {
    console.error("[Snapshot] Save failed:", e);
    return { success: false, error: e.message };
  }
};

/**
 * Gets the current snapshot.
 * @returns {Promise<{version: number, timestamp: number, keys: Object<string, string>}|null>} The snapshot or null.
 */
export const getSnapshot = async () => {
  try {
    const { primaryDb } = await import("./db.js");
    return await primaryDb.get(SNAPSHOT_KEY);
  } catch (e) {
    console.warn("[Snapshot] Get failed:", e);
    return null;
  }
};

/**
 * Gets information about the current snapshot.
 * @returns {Promise<{timestamp: number, date: string, version: number, keyCount: number, keys: string[]}|null>} Snapshot info.
 */
export const getSnapshotInfo = async () => {
  const snapshot = await getSnapshot();
  if (!snapshot) return null;

  return {
    timestamp: snapshot.timestamp,
    date: new Date(snapshot.timestamp).toLocaleString("ko-KR"),
    version: snapshot.version,
    keyCount: Object.keys(snapshot.keys || {}).length,
    keys: Object.keys(snapshot.keys || []),
  };
};

/**
 * Checks if a snapshot exists.
 * @returns {Promise<boolean>} Whether a snapshot exists.
 */
export const hasSnapshot = async () => {
  const { primaryDb } = await import("./db.js");
  const data = await primaryDb.get(SNAPSHOT_KEY);
  return data !== null;
};

/**
 * Restores data from a snapshot.
 * @param {{keys?: string[]}} [options] - Restore options.
 * @returns {Promise<{success: boolean, restored: string[], error?: string}>} Result.
 */
export const restoreFromSnapshot = async (options = {}) => {
  const snapshot = await getSnapshot();
  if (!snapshot) {
    return { success: false, error: "No snapshot available", restored: [] };
  }

  // snapshot.keys contains the data in the format expected by importAll
  // (or at least compatible with it, as it was created by exportAll)
  const keysToRestore = options.keys || Object.keys(snapshot.keys || {});
  const restored = [];

  try {
    const { primaryDb } = await import("./db.js");

    // Filter data if specific keys requested
    /** @type {Object<string, any>} */
    const dataToImport = {};
    for (const key of keysToRestore) {
      if (snapshot.keys[key]) {
        dataToImport[key] = snapshot.keys[key];
        restored.push(key);
      }
    }

    await primaryDb.importAll(dataToImport, true);

    return { success: true, restored };
  } catch (e) {
    console.error("[Snapshot] Restore failed:", e);
    return { success: false, error: e.message, restored };
  }
};

/**
 * Clears the stored snapshot.
 */
export const clearSnapshot = async () => {
  const { primaryDb } = await import("./db.js");
  await primaryDb.delete(SNAPSHOT_KEY);
};

/**
 * Logs a failure for debugging purposes.
 * @param {any} error - The error.
 * @param {Object} [context] - Additional context.
 */
export const logFailure = async (error, context = {}) => {
  try {
    const { primaryDb } = await import("./db.js");
    const logs = (await primaryDb.get(FAILURE_LOG_KEY)) || [];

    logs.push({
      timestamp: Date.now(),
      date: new Date().toISOString(),
      error: String(error),
      context: {
        ...context,
        userAgent: navigator.userAgent?.slice(0, 100),
      },
    });

    while (logs.length > MAX_FAILURE_LOGS) {
      logs.shift();
    }

    await primaryDb.set(FAILURE_LOG_KEY, logs);
  } catch (e) {
    console.warn("[Snapshot] Failed to log failure:", e);
  }
};

/**
 * Gets all failure logs.
 * @returns {Promise<any[]>} Array of failure logs.
 */
export const getFailureLogs = async () => {
  const { primaryDb } = await import("./db.js");
  return (await primaryDb.get(FAILURE_LOG_KEY)) || [];
};

/**
 * Clears all failure logs.
 */
export const clearFailureLogs = async () => {
  const { primaryDb } = await import("./db.js");
  await primaryDb.delete(FAILURE_LOG_KEY);
};

/** @type {number|null} */
let snapshotDebounceTimer = null;

/**
 * Saves a snapshot with debouncing.
 * @param {number} [delayMs=1000] - Debounce delay in milliseconds.
 */
export const debouncedSave = (delayMs = 1000) => {
  if (snapshotDebounceTimer) {
    clearTimeout(snapshotDebounceTimer);
  }
  snapshotDebounceTimer = window.setTimeout(() => {
    saveSnapshot(); // This is async but we don't await it in debounce
    snapshotDebounceTimer = null;
  }, delayMs);
};
