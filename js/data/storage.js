// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";

const DEFAULT_CAT_ID = "17310010083";

/**
 * 현재 필터 상태를 로컬 스토리지에 저장합니다.
 */
export const saveFilterState = () => {
  const activeCats = [...state.activeCategoryIds];
  const activeRegs = [...state.activeRegionNames];

  (async () => {
    try {
      const { primaryDb } = await import("../storage/db.js");
      const result = await primaryDb.setMultiple([
        { key: `activeCats_${state.currentMapKey}`, value: activeCats },
        { key: `activeRegs_${state.currentMapKey}`, value: activeRegs }
      ]);
      if (!result || !result.success) {
        console.warn("Failed to save filter state:", result?.error);
      }
    } catch (error) {
      console.warn("Failed to save filter state:", error);
    }
  })();
};

/**
 * 로컬 스토리지에서 즐겨찾기를 로드합니다.
 * @param {string} mapKey - 맵 키.
 * @returns {any[]} 로드된 즐겨찾기 배열.
 */
export const loadFavorites = (mapKey) => {
  // 즐겨찾기는 앱 초기화 시 Vault에서 이미 state로 로드됩니다.
  // 여기서는 단순히 state를 사용하고 있는지 확인하면 됩니다.
  return state.favorites || [];
};

/**
 * 로컬 스토리지에서 카테고리 필터를 로드합니다.
 * @param {string} mapKey - 맵 키.
 */
export const loadCategoryFilters = async (mapKey) => {
  const validCategoryIds = new Set(state.mapData.categories.map((c) => c.id));

  // Load from Vault
  const { primaryDb } = await import("../storage/db.js");
  const savedCats = await primaryDb.get(`activeCats_${mapKey}`);

  state.activeCategoryIds.clear();

  if (savedCats && Array.isArray(savedCats)) {
    savedCats.forEach((id) => {
      if (validCategoryIds.has(id)) {
        state.activeCategoryIds.add(id);
      }
    });
  } else {
    if (validCategoryIds.has(DEFAULT_CAT_ID)) {
      state.activeCategoryIds.add(DEFAULT_CAT_ID);
    } else if (state.mapData.categories.length > 0) {
      state.activeCategoryIds.add(state.mapData.categories[0].id);
    }
  }

  // 리스너에게 업데이트 트리거
  setState("activeCategoryIds", new Set(state.activeCategoryIds));
};

/**
 * 로컬 스토리지에서 지역 필터를 로드합니다.
 * @param {string} mapKey - 맵 키.
 */
export const loadRegionFilters = async (mapKey) => {
  // Load from Vault
  const { primaryDb } = await import("../storage/db.js");
  const savedRegs = await primaryDb.get(`activeRegs_${mapKey}`);

  state.activeRegionNames.clear();

  if (!savedRegs) {
    state.uniqueRegions.forEach((r) => state.activeRegionNames.add(r));
  } else if (Array.isArray(savedRegs)) {
    savedRegs.forEach((r) => {
      if (state.uniqueRegions.has(r)) {
        state.activeRegionNames.add(r);
      }
    });
  }

  // 업데이트 트리거
  setState("activeRegionNames", new Set(state.activeRegionNames));
};

/**
 * 스토리지에서 필터를 초기화합니다.
 * @param {string} mapKey - 맵 키.
 */
export const initializeFiltersFromStorage = async (mapKey) => {
  loadFavorites(mapKey);
  await Promise.all([
    loadCategoryFilters(mapKey),
    loadRegionFilters(mapKey)
  ]);
  saveFilterState();
};
