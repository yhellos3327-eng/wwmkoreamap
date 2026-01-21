// @ts-check
import { core } from "./core.js";
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
 * @returns {{success: boolean, size?: number, keyCount?: number, error?: string}} Result.
 */
export const saveSnapshot = (options = {}) => {
  try {
    const keysToSnapshot = options.keys || getCurrentSnapshotKeys();

    const snapshot = {
      version: 1,
      timestamp: Date.now(),
      keys: {},
    };

    for (const key of keysToSnapshot) {
      const rawValue = localStorage.getItem(key);
      if (rawValue !== null) {
        snapshot.keys[key] = rawValue;
      }
    }

    const snapshotStr = JSON.stringify(snapshot);

    if (snapshotStr.length > MAX_SNAPSHOT_SIZE) {
      console.warn("[Snapshot] Snapshot too large:", snapshotStr.length);
      return {
        success: false,
        error: "Snapshot exceeds size limit",
        size: snapshotStr.length,
      };
    }

    localStorage.setItem(SNAPSHOT_KEY, snapshotStr);

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
 * @returns {{version: number, timestamp: number, keys: Object<string, string>}|null} The snapshot or null.
 */
export const getSnapshot = () => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[Snapshot] Parse failed:", e);
    return null;
  }
};

/**
 * Gets information about the current snapshot.
 * @returns {{timestamp: number, date: string, version: number, keyCount: number, keys: string[]}|null} Snapshot info.
 */
export const getSnapshotInfo = () => {
  const snapshot = getSnapshot();
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
 * @returns {boolean} Whether a snapshot exists.
 */
export const hasSnapshot = () => {
  return localStorage.getItem(SNAPSHOT_KEY) !== null;
};

/**
 * Restores data from a snapshot.
 * @param {{keys?: string[]}} [options] - Restore options.
 * @returns {{success: boolean, restored: string[], error?: string}} Result.
 */
export const restoreFromSnapshot = (options = {}) => {
  const snapshot = getSnapshot();
  if (!snapshot) {
    return { success: false, error: "No snapshot available", restored: [] };
  }

  const keysToRestore = options.keys || Object.keys(snapshot.keys || {});
  const restored = [];

  try {
    for (const key of keysToRestore) {
      const value = snapshot.keys[key];
      if (value !== undefined) {
        localStorage.setItem(key, value);
        restored.push(key);
      }
    }

    return { success: true, restored };
  } catch (e) {
    console.error("[Snapshot] Restore failed:", e);
    return { success: false, error: e.message, restored };
  }
};

/**
 * Clears the stored snapshot.
 */
export const clearSnapshot = () => {
  localStorage.removeItem(SNAPSHOT_KEY);
};

/**
 * Logs a failure for debugging purposes.
 * @param {any} error - The error.
 * @param {Object} [context] - Additional context.
 */
export const logFailure = (error, context = {}) => {
  try {
    const logs = core.getJSON(FAILURE_LOG_KEY, []);

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

    core.setJSON(FAILURE_LOG_KEY, logs);
  } catch (e) {
    console.warn("[Snapshot] Failed to log failure:", e);
  }
};

/**
 * Gets all failure logs.
 * @returns {any[]} Array of failure logs.
 */
export const getFailureLogs = () => {
  return core.getJSON(FAILURE_LOG_KEY, []);
};

/**
 * Clears all failure logs.
 */
export const clearFailureLogs = () => {
  core.remove(FAILURE_LOG_KEY);
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
    saveSnapshot();
    snapshotDebounceTimer = null;
  }, delayMs);
};
