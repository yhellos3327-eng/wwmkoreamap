// @ts-check
import { BACKEND_URL } from "../config.js";

/**
 * Fetches user data from the cloud.
 * @returns {Promise<any|null>} The cloud data or null.
 */
export const fetchCloudData = async () => {
  const response = await fetch(`${BACKEND_URL}/api/sync/load`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const result = await response.json();
  return result.success ? result.data : null;
};

/**
 * Saves user data to the cloud.
 * @param {any} data - The data to save.
 * @returns {Promise<any>} The save response.
 */
export const saveCloudData = async (data) => {
  const response = await fetch(`${BACKEND_URL}/api/sync/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
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
 * @returns {Promise<any>} The save response.
 */
export const saveCloudBackup = async (label = null) => {
  const response = await fetch(`${BACKEND_URL}/api/backup/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ label }),
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
