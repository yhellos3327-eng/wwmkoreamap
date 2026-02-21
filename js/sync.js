// @ts-check
/**
 * 동기화 모듈 - 동기화 기능을 다시 내보냅니다.
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
