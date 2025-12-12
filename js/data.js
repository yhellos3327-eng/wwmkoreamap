import { MAP_CONFIGS } from './config.js';
import { state, setState, updateState } from './state.js';
import { t } from './utils.js';
import { initMap, renderMapDataAndMarkers } from './map.js';
import { refreshCategoryList, updateToggleButtonsState, renderFavorites } from './ui.js';
import { calculateTranslationProgress } from './translation.js';

export const loadMapData = async (mapKey) => {
    const config = MAP_CONFIGS[mapKey];
    if (!config) return;

    try {
        initMap(mapKey);

        const [dataRes, regionRes] = await Promise.all([
            fetch(config.dataFile),
            fetch(config.regionFile)
        ]);

        if (!dataRes.ok) throw new Error(`${config.dataFile} 로드 실패`);
        if (!regionRes.ok) throw new Error(`${config.regionFile} 로드 실패`);

        const dataJson = await dataRes.json();
        const regionJson = await regionRes.json();

        const regionData = regionJson.data || [];
        setState('regionData', regionData);

        const regionIdMap = {};
        const regionMetaInfo = {};

        const totalBounds = L.latLngBounds([]);

        if (regionData && Array.isArray(regionData)) {
            regionData.forEach(region => {
                regionIdMap[region.id] = region.title;
                regionMetaInfo[region.title] = {
                    lat: parseFloat(region.latitude),
                    lng: parseFloat(region.longitude),
                    zoom: region.zoom || 12
                };

                if (region.coordinates && region.coordinates.length > 0) {
                    const coords = region.coordinates.map(c => [parseFloat(c[1]), parseFloat(c[0])]);
                    totalBounds.extend(coords);
                }
            });
        }
        setState('regionMetaInfo', regionMetaInfo);

        if (totalBounds.isValid()) {
            state.map.setMaxBounds(totalBounds.pad(0.85));
            state.map.options.minZoom = config.minZoom;

            if (state.currentTileLayer) {
                const padding = (config.tilePadding !== undefined) ? config.tilePadding : 0.1;
                state.currentTileLayer.options.bounds = totalBounds.pad(padding);
                state.currentTileLayer.redraw();
            }
        }

        const rawItems = dataJson.data || [];
        const itemsByCategory = {};

        const mapData = { categories: [], items: [] };

        mapData.items = rawItems.map(item => {
            const catId = String(item.category_id);
            const regionName = regionIdMap[item.regionId] || "알 수 없음";

            let imgList = [];
            if (item.images && Array.isArray(item.images) && item.images.length > 0) {
                imgList = item.images;
            } else if (item.image) {
                imgList = [item.image];
            }

            return {
                ...item,
                id: item.id,
                category: catId,
                name: item.title || "Unknown",
                description: item.description || "",
                x: item.latitude,
                y: item.longitude,
                region: regionName,
                images: imgList,
                imageSizeW: 44,
                imageSizeH: 44,
                isTranslated: false
            };
        });

        const uniqueCategoryIds = new Set(mapData.items.map(i => i.category));

        mapData.categories = Array.from(uniqueCategoryIds).map(catId => {
            return {
                id: catId,
                name: catId,
                image: `./icons/${catId}.png`
            };
        });

        mapData.items.forEach(item => {
            const catTrans = state.categoryItemTranslations[item.category];
            let commonDesc = null;

            if (catTrans && catTrans._common_description) {
                commonDesc = catTrans._common_description;
            }

            if (catTrans) {
                let transData = catTrans[item.id];
                if (!transData && item.name) {
                    transData = catTrans[item.name];
                }

                if (transData) {
                    if (transData.name) {
                        item.name = transData.name;
                        item.isTranslated = true;
                    }
                    if (transData.description) {
                        item.description = transData.description;
                    }
                    if (transData.region) item.forceRegion = transData.region;
                }
            }

            if ((!item.description || item.description.trim() === "") && commonDesc) {
                item.description = commonDesc;
            }
        });

        mapData.items.forEach(item => {
            if (!itemsByCategory[item.category]) {
                itemsByCategory[item.category] = [];
            }
            itemsByCategory[item.category].push(item);
        });

        for (const key in itemsByCategory) {
            itemsByCategory[key].sort((a, b) => t(a.name).localeCompare(t(b.name)));
        }

        setState('mapData', mapData);
        setState('itemsByCategory', itemsByCategory);

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

        const DEFAULT_CAT_ID = "17310010083";
        let savedRegs = JSON.parse(localStorage.getItem(`wwm_active_regs_${mapKey}`)) || [];

        const validCategoryIds = new Set(mapData.categories.map(c => c.id));

        state.activeCategoryIds.clear();

        let savedCats = JSON.parse(localStorage.getItem(`wwm_active_cats_${mapKey}`)) || [];

        if (savedCats.length > 0) {
            savedCats.forEach(id => {
                state.activeCategoryIds.add(id);
            });
        }
        if (savedCats.length === 0) {
            if (validCategoryIds.has(DEFAULT_CAT_ID)) {
                state.activeCategoryIds.add(DEFAULT_CAT_ID);
            } else if (mapData.categories.length > 0) {
                state.activeCategoryIds.add(mapData.categories[0].id);
            }
        }

        const currentMapRegions = new Set();
        regionData.forEach(r => currentMapRegions.add(r.title));
        mapData.items.forEach(i => {
            if (i.region) currentMapRegions.add(i.region);
        });

        setState('uniqueRegions', currentMapRegions);

        const filteredSavedRegs = savedRegs.filter(r => currentMapRegions.has(r));

        state.activeRegionNames.clear();

        if (filteredSavedRegs.length > 0) {
            filteredSavedRegs.forEach(r => state.activeRegionNames.add(r));
        } else {
            state.uniqueRegions.forEach(r => state.activeRegionNames.add(r));
        }

        saveFilterState();

        renderMapDataAndMarkers();
        calculateTranslationProgress();
        refreshCategoryList();
        updateToggleButtonsState();
        renderFavorites();
    } catch (error) {
        console.error("데이터 로드 실패:", error);
        alert(`${config.name} 데이터를 불러오는데 실패했습니다.\n` + error.message);
    }
};

export const saveFilterState = () => {
    localStorage.setItem(`wwm_active_cats_${state.currentMapKey}`, JSON.stringify([...state.activeCategoryIds]));
    localStorage.setItem(`wwm_active_regs_${state.currentMapKey}`, JSON.stringify([...state.activeRegionNames]));
};
