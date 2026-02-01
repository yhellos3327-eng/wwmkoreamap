// @ts-check
import { BACKEND_URL } from "../config.js";

/**
 * Fetches user data from the cloud.
 * @returns {Promise<{data: any|null, version: number}>} The cloud data and version.
 */
export const fetchCloudData = async () => {
  const response = await fetch(`${BACKEND_URL}/api/sync/load`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const result = await response.json();
  // Backend returns: { success, data: {...}, version: N }
  return {
    data: result.success ? result.data : null,
    version: result.version || 0
  };
};

/**
 * Saves user data to the cloud.
 * @param {any} data - The data to save.
 * @param {number|undefined} expectedVersion - The expected server version for optimistic locking.
 * @returns {Promise<any>} The save response.
 */
export const saveCloudData = async (data, expectedVersion = undefined) => {
  const payload = { ...data };
  if (expectedVersion !== undefined) {
    payload.expectedVersion = expectedVersion;
  }

  const response = await fetch(`${BACKEND_URL}/api/sync/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  // Handle Conflict (409) specifically
  if (response.status === 409) {
    const errorData = await response.json();
    const error = new Error(`Conflict detected: ${errorData.message}`);
    error.name = "VersionConflictError";
    error.serverVersion = errorData.currentVersion;
    throw error;
  }

  if (!response.ok) throw new Error(`Failed to save: ${response.status}`);
  return await response.json();
};

/**
 * Fetches the list of backups from the cloud.
 * @returns {Promise<any[]>} Array of backups.
 */
export const fetchBackupList = async () => {
  const response = await fetch(`${BACKEND_URL}/api/backup/list`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const result = await response.json();
  return result.success ? result.backups : [];
};

/**
 * Creates a cloud backup.
 * @param {string|null} [label=null] - Optional backup label.
 * @param {any|null} [data=null] - Optional data to backup directly (overrides server state).
 * @returns {Promise<any>} The save response.
 */
export const saveCloudBackup = async (label = null, data = null) => {
  const payload = { label };
  if (data) {
    Object.assign(payload, data);
  }

  const response = await fetch(`${BACKEND_URL}/api/backup/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Failed to save: ${response.status}`);
  return await response.json();
};

/**
 * Restores data from a backup.
 * @param {string} backupId - The backup ID to restore.
 * @returns {Promise<any>} The restore response.
 */
export const restoreFromBackup = async (backupId) => {
  const response = await fetch(
    `${BACKEND_URL}/api/backup/restore/${backupId}`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) throw new Error(`Failed to restore: ${response.status}`);
  return await response.json();
};
