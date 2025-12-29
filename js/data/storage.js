import { state, setState } from '../state.js';

const DEFAULT_CAT_ID = "17310010083";

export const saveFilterState = () => {
    localStorage.setItem(
        `wwm_active_cats_${state.currentMapKey}`,
        JSON.stringify([...state.activeCategoryIds])
    );
    localStorage.setItem(
        `wwm_active_regs_${state.currentMapKey}`,
        JSON.stringify([...state.activeRegionNames])
    );
};

export const loadFavorites = (mapKey) => {
    const favStorageKey = `wwm_favorites_${mapKey}`;
    let favorites = JSON.parse(localStorage.getItem(favStorageKey)) || [];

    if (mapKey === 'qinghe' && favorites.length === 0) {
        const oldFavs = JSON.parse(localStorage.getItem('wwm_favorites'));
        if (oldFavs && oldFavs.length > 0) {
            favorites = oldFavs;
            localStorage.setItem(favStorageKey, JSON.stringify(favorites));
        }
    }

    setState('favorites', favorites);
    return favorites;
};

export const loadCategoryFilters = (mapKey) => {
    const validCategoryIds = new Set(state.mapData.categories.map(c => c.id));
    state.activeCategoryIds.clear();

    const savedCats = JSON.parse(localStorage.getItem(`wwm_active_cats_${mapKey}`)) || [];

    if (savedCats.length > 0) {
        savedCats.forEach(id => state.activeCategoryIds.add(id));
    }

    if (savedCats.length === 0) {
        if (validCategoryIds.has(DEFAULT_CAT_ID)) {
            state.activeCategoryIds.add(DEFAULT_CAT_ID);
        } else if (state.mapData.categories.length > 0) {
            state.activeCategoryIds.add(state.mapData.categories[0].id);
        }
    }
};

export const loadRegionFilters = (mapKey) => {
    const savedRegs = JSON.parse(localStorage.getItem(`wwm_active_regs_${mapKey}`)) || [];
    const filteredSavedRegs = savedRegs.filter(r => state.uniqueRegions.has(r));

    state.activeRegionNames.clear();

    if (filteredSavedRegs.length > 0) {
        // 저장된 지역 활성화
        filteredSavedRegs.forEach(r => state.activeRegionNames.add(r));

        // 새로 추가된 지역도 기본 활성화 (저장 시점에 없던 지역)
        const savedRegsSet = new Set(savedRegs);
        state.uniqueRegions.forEach(r => {
            if (!savedRegsSet.has(r)) {
                state.activeRegionNames.add(r);
            }
        });
    } else {
        // 저장된 필터가 없으면 모든 지역 활성화
        state.uniqueRegions.forEach(r => state.activeRegionNames.add(r));
    }
};

export const initializeFiltersFromStorage = (mapKey) => {
    loadFavorites(mapKey);
    loadCategoryFilters(mapKey);
    loadRegionFilters(mapKey);
    saveFilterState();
};
