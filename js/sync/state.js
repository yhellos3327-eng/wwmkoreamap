let syncTimeout = null;
let isSyncing = false;
let pollingInterval = null;
let lastSyncVersion = null;

export const SYNC_DELAY = 2000;
export const POLLING_INTERVAL = 60000;

export const getSyncState = () => ({ isSyncing, lastSyncVersion });
export const setSyncing = (val) => { isSyncing = val; };
export const setLastSyncVersion = (val) => { lastSyncVersion = val; };

export const getSyncTimeout = () => syncTimeout;
export const setSyncTimeout = (val) => { syncTimeout = val; };

export const getPollingInterval = () => pollingInterval;
export const setPollingInterval = (val) => { pollingInterval = val; };
