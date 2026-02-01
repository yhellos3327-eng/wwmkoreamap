// @ts-check

/** @type {number|null} */
let syncTimeout = null;

/** @type {boolean} */
let isSyncing = false;

/** @type {number|null} */
let pollingInterval = null;

/** @type {string|null} */
let lastSyncVersion = null;

/** @type {boolean} */
let isInitialSyncComplete = false;

/** @type {number} */
let serverDataVersion = 0;

/** @type {number} */
// Increased from 2000ms to 5000ms to reduce sync frequency
export const SYNC_DELAY = 5000;

/** @type {number} */
// Increased from 60000ms (1 min) to 120000ms (2 min) to reduce polling frequency
export const POLLING_INTERVAL = 120000;

/**
 * Gets the current sync state.
 * @returns {{isSyncing: boolean, lastSyncVersion: string|null, isInitialSyncComplete: boolean, serverDataVersion: number}} The sync state.
 */
export const getSyncState = () => ({ isSyncing, lastSyncVersion, isInitialSyncComplete, serverDataVersion });

/**
 * Sets the syncing flag.
 * @param {boolean} val - The syncing state.
 */
export const setSyncing = (val) => {
  isSyncing = val;
};

/**
 * Sets the server data version.
 * @param {number} val - The version number.
 */
export const setServerDataVersion = (val) => {
  serverDataVersion = val;
};

/**
 * Sets the initial sync completion status.
 * @param {boolean} val - The completion status.
 */
export const setInitialSyncComplete = (val) => {
  isInitialSyncComplete = val;
};

/**
 * Sets the last sync version hash.
 * @param {string|null} val - The version hash.
 */
export const setLastSyncVersion = (val) => {
  lastSyncVersion = val;
};

/**
 * Gets the sync timeout.
 * @returns {number|null} The timeout ID.
 */
export const getSyncTimeout = () => syncTimeout;

/**
 * Sets the sync timeout.
 * @param {number|null} val - The timeout ID.
 */
export const setSyncTimeout = (val) => {
  syncTimeout = val;
};

/**
 * Gets the polling interval.
 * @returns {number|null} The interval ID.
 */
export const getPollingInterval = () => pollingInterval;

/**
 * Sets the polling interval.
 * @param {number|null} val - The interval ID.
 */
export const setPollingInterval = (val) => {
  pollingInterval = val;
};
