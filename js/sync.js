// @ts-check
/**
 * @fileoverview Sync module - re-exports synchronization functionality.
 * @module sync
 */

export {
  initSync,
  triggerSync,
  saveToCloud,
  loadFromCloud,
  performFullSync,
  cleanupRealtimeSync,
  updateSettingWithTimestamp,
  mergeData,
  getLocalData,
  setLocalData,
} from "./sync/core.js";
