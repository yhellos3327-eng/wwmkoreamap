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
 * 현재 동기화 상태를 가져옵니다.
 * @returns {{isSyncing: boolean, lastSyncVersion: string|null, isInitialSyncComplete: boolean, serverDataVersion: number}} 동기화 상태.
 */
export const getSyncState = () => ({ isSyncing, lastSyncVersion, isInitialSyncComplete, serverDataVersion });

/**
 * 동기화 중 플래그를 설정합니다.
 * @param {boolean} val - 동기화 상태.
 */
export const setSyncing = (val) => {
  isSyncing = val;
};

/**
 * 서버 데이터 버전을 설정합니다.
 * @param {number} val - 버전 번호.
 */
export const setServerDataVersion = (val) => {
  serverDataVersion = val;
};

/**
 * 초기 동기화 완료 상태를 설정합니다.
 * @param {boolean} val - 완료 상태.
 */
export const setInitialSyncComplete = (val) => {
  isInitialSyncComplete = val;
};

/**
 * 마지막 동기화 버전 해시를 설정합니다.
 * @param {string|null} val - 버전 해시.
 */
export const setLastSyncVersion = (val) => {
  lastSyncVersion = val;
};

/**
 * 동기화 타임아웃을 가져옵니다.
 * @returns {number|null} 타임아웃 ID.
 */
export const getSyncTimeout = () => syncTimeout;

/**
 * 동기화 타임아웃을 설정합니다.
 * @param {number|null} val - 타임아웃 ID.
 */
export const setSyncTimeout = (val) => {
  syncTimeout = val;
};

/**
 * 폴링 인터벌을 가져옵니다.
 * @returns {number|null} 인터벌 ID.
 */
export const getPollingInterval = () => pollingInterval;

/**
 * 폴링 인터벌을 설정합니다.
 * @param {number|null} val - 인터벌 ID.
 */
export const setPollingInterval = (val) => {
  pollingInterval = val;
};
