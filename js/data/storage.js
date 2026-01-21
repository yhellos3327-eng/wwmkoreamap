// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";

const DEFAULT_CAT_ID = "17310010083";

/**
 * Saves the current filter state to local storage.
 */
export const saveFilterState = () => {
  localStorage.setItem(
    `wwm_active_cats_${state.currentMapKey}`,
    JSON.stringify([...state.activeCategoryIds]),
  );
  localStorage.setItem(
    `wwm_active_regs_${state.currentMapKey}`,
    JSON.stringify([...state.activeRegionNames]),
  );
};

/**
 * Loads favorites from local storage.
 * @param {string} mapKey - The map key.
 * @returns {any[]} The loaded favorites.
 */
export const loadFavorites = (mapKey) => {
  const favStorageKey = `wwm_favorites_${mapKey}`;
  let favorites = JSON.parse(localStorage.getItem(favStorageKey) || "[]") || [];

  if (mapKey === "qinghe" && favorites.length === 0) {
    const oldFavs = JSON.parse(localStorage.getItem("wwm_favorites") || "[]");
    if (oldFavs && oldFavs.length > 0) {
      favorites = oldFavs;
      localStorage.setItem(favStorageKey, JSON.stringify(favorites));
    }
  }

  setState("favorites", favorites);
  return favorites;
};

/**
 * Loads category filters from local storage.
 * @param {string} mapKey - The map key.
 */
export const loadCategoryFilters = (mapKey) => {
  const validCategoryIds = new Set(state.mapData.categories.map((c) => c.id));
  const storageKey = `wwm_active_cats_${mapKey}`;
  const savedCatsRaw = localStorage.getItem(storageKey);

  state.activeCategoryIds.clear();

  if (savedCatsRaw !== null) {
    try {
      const savedCats = JSON.parse(savedCatsRaw);
      if (Array.isArray(savedCats)) {
        savedCats.forEach((id) => {
          if (validCategoryIds.has(id)) {
            state.activeCategoryIds.add(id);
          }
        });
      }
    } catch (e) {
      console.error("Failed to parse saved categories:", e);
      if (validCategoryIds.has(DEFAULT_CAT_ID)) {
        state.activeCategoryIds.add(DEFAULT_CAT_ID);
      }
    }
  } else {
    if (validCategoryIds.has(DEFAULT_CAT_ID)) {
      state.activeCategoryIds.add(DEFAULT_CAT_ID);
    } else if (state.mapData.categories.length > 0) {
      state.activeCategoryIds.add(state.mapData.categories[0].id);
    }
  }
};

/**
 * Loads region filters from local storage.
 * @param {string} mapKey - The map key.
 */
export const loadRegionFilters = (mapKey) => {
  const storageKey = `wwm_active_regs_${mapKey}`;
  const savedRegsRaw = localStorage.getItem(storageKey);

  state.activeRegionNames.clear();

  if (savedRegsRaw === null) {
    state.uniqueRegions.forEach((r) => state.activeRegionNames.add(r));
    return;
  }

  const savedRegs = JSON.parse(savedRegsRaw) || [];

  savedRegs.forEach((r) => {
    if (state.uniqueRegions.has(r)) {
      state.activeRegionNames.add(r);
    }
  });
};

/**
 * Initializes filters from storage.
 * @param {string} mapKey - The map key.
 */
export const initializeFiltersFromStorage = (mapKey) => {
  loadFavorites(mapKey);
  loadCategoryFilters(mapKey);
  loadRegionFilters(mapKey);
  saveFilterState();
};
