// @ts-check
/**
 * 동기화 저장소 모듈 - Dexie.js (IndexedDB)를 단일 진실 공급원(Single Source of Truth)으로 사용합니다.
 * DEXIE.JS 마이그레이션: localStorage 의존성 제거, Vault 전용.
 */

import { primaryDb } from "../storage/db.js";
import { store } from "../state.js";
import { createLogger } from "../utils/logStyles.js";

const log = createLogger("Storage");

/**
 * @typedef {Object} SyncData
 * @property {any[]} completedMarkers - 완료된 마커 배열.
 * @property {any[]} favorites - 즐겨찾기 배열.
 * @property {any} settings - 설정 객체.
 */

/**
 * 데이터 보호를 위한 안전 임계값.
 * 현재 데이터가 이 숫자를 초과하고 새 데이터가 비어 있는 경우 덮어쓰기를 차단합니다.
 */
const SAFETY_CONFIG = {
  /** 빈 데이터 덮어쓰기를 차단하기 위한 최소 완료 항목 수 */
  MIN_COMPLETED_THRESHOLD: 10,
  /** 빈 데이터 덮어쓰기를 차단하기 위한 최소 즐겨찾기 수 */
  MIN_FAVORITES_THRESHOLD: 5,
  /** 허용되는 최대 데이터 유실 비율 (0.3 = 30%) */
  MAX_LOSS_RATIO: 0.3,
};

/**
 * @typedef {Object} SetLocalDataResult
 * @property {boolean} success - 작업 성공 여부.
 * @property {boolean} blocked - 안전 가드에 의해 작업이 차단되었는지 여부.
 * @property {string} [reason] - 차단 이유.
 */

/**
 * Vault(Dexie.js)에서 로컬 데이터를 가져옵니다.
 * DEXIE.JS 마이그레이션: 캐시된 데이터 또는 빈 배열을 반환합니다.
 * 비동기 액세스는 getLocalDataAsync()를 대신 사용하십시오.
 * @returns {SyncData} 로컬 데이터 (아직 로드되지 않은 경우 비어 있을 수 있음).
 */
export const getLocalData = () => {
  // DEXIE.JS MIGRATION: This synchronous function now returns state data
  // which is already loaded from Vault via initStateFromVault()
  try {
    // 스토어 상태 직접 사용
    const state = store.getState();
    if (!state || !state.isStateInitialized) {
      log.warn("상태가 아직 Vault에서 초기화되지 않았습니다. 빈 데이터를 반환합니다.");
      return { completedMarkers: [], favorites: [], settings: {} };
    }

    return {
      completedMarkers: (state.completedList || []).filter(item => {
        const idStr = String(item.id);
        const communityMarkers = state.communityMarkers;
        return !communityMarkers || !communityMarkers.has(idStr);
      }),
      favorites: state.favorites || [],
      settings: getSettingsFromState(state)
    };
  } catch (e) {
    log.warn("getLocalData 실패, 빈 데이터로 대체", e);
    return { completedMarkers: [], favorites: [], settings: {} };
  }
};

/**
 * 현재 상태에서 설정을 가져옵니다.
 * @param {any} state - 앱 상태.
 * @returns {Object} 설정 객체.
 */
const getSettingsFromState = (state) => {
  return {
    showComments: state.showComments ?? true,
    closeOnComplete: state.closeOnComplete ?? false,
    hideCompleted: state.hideCompleted ?? false,
    enableClustering: state.enableClustering ?? true,
    regionColor: state.savedRegionColor,
    regionFillColor: state.savedRegionFillColor,
    gpuMode: state.savedGpuSetting,
    aiProvider: state.savedAIProvider,
    apiModel: state.savedApiModel,
    menuPosition: state.savedMenuPosition,
    useChromeTranslator: state.useChromeTranslator,
    disableRegionClickPan: state.disableRegionClickPan,
    enableWebLLM: state.enableWebLLM ?? false,
  };
};

/**
 * Vault(Dexie.js)에 로컬 데이터를 설정합니다.
 * DEXIE.JS 마이그레이션: 항상 비동기 Vault 저장을 사용합니다.
 * @param {SyncData} data - 저장할 데이터.
 * @returns {Promise<SetLocalDataResult>} 작업 결과.
 */
export const setLocalData = async (data) => {
  if (!data) return { success: false, blocked: false, reason: "No data provided" };

  // DEXIE.JS MIGRATION: Always use async Vault save
  try {
    const result = await setLocalDataAsync(data);
    if (!result.success) {
      log.error("Vault 저장 실패", result.reason);
    }
    return result;
  } catch (e) {
    log.error("Vault save failed", e);
    return { success: false, blocked: false, reason: e.message };
  }
};

// ============================================================================
// ASYNC VAULT FUNCTIONS - Dexie.js as single source of truth
// ============================================================================

/**
 * Vault(Dexie.js)에서 비동기적으로 로컬 데이터를 가져옵니다.
 * 이것이 데이터 액세스를 위한 기본 방법입니다.
 * @returns {Promise<SyncData>} 로컬 데이터.
 */
export const getLocalDataAsync = async () => {
  try {
    const completedMarkers = await primaryDb.get("completedList") || [];
    const favorites = await primaryDb.get("favorites") || [];
    const settings = await primaryDb.get("settings") || {};

    const state = store.getState();
    const communityMarkers = state.communityMarkers;

    // 유지된 목록에서 커뮤니티 마커 필터링
    const filteredCompletedList = Array.isArray(completedMarkers)
      ? completedMarkers.filter(item => !communityMarkers || !communityMarkers.has(String(item.id)))
      : [];

    return { completedMarkers: filteredCompletedList, favorites, settings };
  } catch (e) {
    log.error("getLocalDataAsync 실패", e);
    return { completedMarkers: [], favorites: [], settings: {} };
  }
};

/**
 * Vault(Dexie.js)에 로컬 데이터를 비동기적으로 설정합니다.
 * @param {SyncData} data - 저장할 데이터.
 * @returns {Promise<SetLocalDataResult>} 작업 결과.
 */
export const setLocalDataAsync = async (data) => {
  if (!data) return { success: false, blocked: false, reason: "No data provided" };

  try {
    const entries = [];
    let completedBlocked = false;
    let favoritesBlocked = false;

    // 안전 가드와 함께 completedMarkers 처리
    if (data.completedMarkers !== undefined) {
      const currentCompleted = await primaryDb.get("completedList") || [];
      const currentCount = Array.isArray(currentCompleted) ? currentCompleted.length : 0;
      const newCount = Array.isArray(data.completedMarkers) ? data.completedMarkers.length : 0;

      // 안전: 의심스러운 데이터 유실 차단
      if (currentCount > SAFETY_CONFIG.MIN_COMPLETED_THRESHOLD) {
        if (newCount === 0) {
          log.error(`차단됨: ${currentCount}개의 완료 항목을 빈 배열로 덮어쓰려는 시도`);
          completedBlocked = true;
        } else if (newCount < currentCount * SAFETY_CONFIG.MAX_LOSS_RATIO) {
          log.error(`차단됨: 의심스러운 데이터 유실 감지됨. ${currentCount} → ${newCount}`);
          completedBlocked = true;
        }
      }

      if (!completedBlocked) {
        const state = store.getState();
        const communityMarkers = state.communityMarkers;

        // 실수로 커뮤니티 마커가 IndexedDB에 저장되지 않도록 함
        const filteredValue = Array.isArray(data.completedMarkers)
          ? data.completedMarkers.filter(item => !communityMarkers || !communityMarkers.has(String(item.id)))
          : data.completedMarkers;

        entries.push({ key: "completedList", value: filteredValue });
      }
    }

    // 안전 가드와 함께 즐겨찾기 처리
    if (data.favorites !== undefined) {
      const currentFavorites = await primaryDb.get("favorites") || [];
      const currentCount = Array.isArray(currentFavorites) ? currentFavorites.length : 0;
      const newCount = Array.isArray(data.favorites) ? data.favorites.length : 0;

      if (currentCount > SAFETY_CONFIG.MIN_FAVORITES_THRESHOLD) {
        if (newCount === 0) {
          log.error(`차단됨: ${currentCount}개의 즐겨찾기를 빈 배열로 덮어쓰려는 시도`);
          favoritesBlocked = true;
        } else if (newCount < currentCount * SAFETY_CONFIG.MAX_LOSS_RATIO) {
          log.error(`차단됨: 의심스러운 즐겨찾기 유실. ${currentCount} → ${newCount}`);
          favoritesBlocked = true;
        }
      }

      if (!favoritesBlocked) {
        entries.push({ key: "favorites", value: data.favorites });
      }
    }

    // 설정 처리
    if (data.settings) {
      entries.push({ key: "settings", value: data.settings });
    }

    // Vault에 저장
    if (entries.length > 0) {
      const result = await primaryDb.setMultiple(entries);
      if (!result.success) {
        return { success: false, blocked: false, reason: result.error };
      }
    }

    const blocked = completedBlocked || favoritesBlocked;
    return {
      success: !blocked,
      blocked,
      reason: blocked ? `차단됨: 완료항목=${completedBlocked}, 즐겨찾기=${favoritesBlocked}` : undefined
    };
  } catch (e) {
    log.error("setLocalDataAsync 실패", e);
    return { success: false, blocked: false, reason: e.message };
  }
};
