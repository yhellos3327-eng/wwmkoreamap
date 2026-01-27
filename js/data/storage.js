// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";

const DEFAULT_CAT_ID = "17310010083";

/**
 * Saves the current filter state to local storage.
 */
export const saveFilterState = () => {
  const activeCats = [...state.activeCategoryIds];
  const activeRegs = [...state.activeRegionNames];

  // Save to Vault
  import("../storage/db.js").then(({ primaryDb }) => {
    primaryDb.setMultiple([
      { key: `activeCats_${state.currentMapKey}`, value: activeCats },
      { key: `activeRegs_${state.currentMapKey}`, value: activeRegs }
    ]).catch(console.warn);
  });
};

/**
 * Loads favorites from local storage.
 * @param {string} mapKey - The map key.
 * @returns {any[]} The loaded favorites.
 */
export const loadFavorites = (mapKey) => {
  // Favorites are already loaded into state from Vault during app initialization
  // We just need to ensure we are using the state
  return state.favorites || [];
};

/**
 * Loads category filters from local storage.
 * @param {string} mapKey - The map key.
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

  // Trigger update to listeners
  setState("activeCategoryIds", new Set(state.activeCategoryIds));
};

/**
 * Loads region filters from local storage.
 * @param {string} mapKey - The map key.
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

  // Trigger update
  setState("activeRegionNames", new Set(state.activeRegionNames));
};

/**
 * Initializes filters from storage.
 * @param {string} mapKey - The map key.
 */
export const initializeFiltersFromStorage = async (mapKey) => {
  loadFavorites(mapKey);
  await Promise.all([
    loadCategoryFilters(mapKey),
    loadRegionFilters(mapKey)
  ]);
  saveFilterState();
};
