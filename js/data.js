import { MAP_CONFIGS } from './config.js';
import { state, setState, updateState } from './state.js';
import { t, fetchWithProgress, fetchAndParseCSVChunks } from './utils.js';
import { initMap, renderMapDataAndMarkers } from './map.js';
import { refreshCategoryList, updateToggleButtonsState, renderFavorites } from './ui.js';
import { calculateTranslationProgress } from './translation.js';

export const loadTranslations = async (mapKey) => {
    // Reset translation state
    state.koDict = {};
    state.categoryItemTranslations = {};
    state.parsedCSV = [];

    const processCSVChunk = (chunkData, headers) => {
        if (!headers) return;

        if (state.parsedCSV.length === 0) {
            state.parsedCSV.push(headers);
        }
        state.parsedCSV.push(...chunkData);

        const typeIdx = headers.indexOf('Type');
        const catIdx = headers.indexOf('Category');
        const keyIdx = headers.indexOf('Key');
        const valIdx = headers.indexOf('Korean');
        const descIdx = headers.indexOf('Description');
        const regIdx = headers.indexOf('Region');
        const imgIdx = headers.indexOf('Image');
        const videoIdx = headers.indexOf('Video');

        chunkData.forEach(row => {
            if (row.length < 3) return;

            const type = row[typeIdx]?.trim();
            const key = row[keyIdx]?.trim();
            if (!key) return;

            if (type === 'Common') {
                const val = row[valIdx];
                if (val) {
                    state.koDict[key] = val;
                    state.koDict[key.trim()] = val;
                }
            } else if (type === 'Override') {
                const catId = row[catIdx]?.trim();
                if (!catId) return;

                if (!state.categoryItemTranslations[catId]) {
                    state.categoryItemTranslations[catId] = {};
                }

                if (key === '_common_description') {
                    state.categoryItemTranslations[catId]._common_description = row[descIdx];
                } else {
                    let desc = row[descIdx];
                    if (desc) {
                        desc = desc.replace(/<hr>/g, '<hr style="border: 0; border-bottom: 1px solid var(--border); margin: 10px 0;">');
                    }

                    let imageRaw = imgIdx !== -1 ? row[imgIdx] : null;
                    let imageData = null;
                    if (imageRaw) {
                        const trimmed = imageRaw.trim();
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                            const content = trimmed.slice(1, -1);
                            imageData = content.split('|').map(v => {
                                let path = v.trim();
                                if (path.includes('{id}')) {
                                    path = path.replace('{id}', key);
                                }
                                return path;
                            }).filter(v => v !== "");
                        } else {
                            let path = trimmed;
                            if (path.includes('{id}')) {
                                path = path.replace('{id}', key);
                            }
                            imageData = path;
                        }
                    }

                    let videoUrl = videoIdx !== -1 ? row[videoIdx] : null;
                    let videoData = null;
                    if (videoUrl) {
                        const trimmed = videoUrl.trim();
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                            const content = trimmed.slice(1, -1);
                            videoData = content.split('|').map(v => v.trim()).filter(v => v !== "");
                        } else {
                            videoData = trimmed;
                        }
                    }

                    state.categoryItemTranslations[catId][key] = {
                        name: row[valIdx],
                        description: desc,
                        region: row[regIdx],
                        image: imageData,
                        video: videoData
                    };
                }
            }
        });
    };

    // Always load base translation
    await fetchAndParseCSVChunks('./translation.csv', processCSVChunk);

    // Load additional translation for Kaifeng
    if (mapKey === 'kaifeng') {
        try {
            await fetchAndParseCSVChunks('./translation2.csv', processCSVChunk);
            console.log("Loaded translation2.csv for Kaifeng");
        } catch (e) {
            console.warn("translation2.csv not found or failed to load", e);
        }
    }
};

export const loadMapData = async (mapKey, onProgress) => {
    const config = MAP_CONFIGS[mapKey];
    if (!config) return;

    try {
        // Load translations first
        await loadTranslations(mapKey);

        initMap(mapKey);

        const progressState = {
            data: { loaded: 0, total: 0 },
            region: { loaded: 0, total: 0 }
        };

        const updateAggregateProgress = () => {
            if (!onProgress) return;
            const totalLoaded = progressState.data.loaded + progressState.region.loaded;
            const totalSize = progressState.data.total + progressState.region.total;
            if (totalSize > 0) {
                onProgress(totalLoaded, totalSize);
            }
        };

        const dataBlobPromise = fetchWithProgress(config.dataFile, (loaded, total) => {
            progressState.data.loaded = loaded;
            progressState.data.total = total;
            updateAggregateProgress();
        });

        const regionBlobPromise = fetchWithProgress(config.regionFile, (loaded, total) => {
            progressState.region.loaded = loaded;
            progressState.region.total = total;
            updateAggregateProgress();
        });

        const missingPromise = fetch('missing_data.csv').catch(e => ({ ok: false }));

        const [dataBlob, regionBlob, missingRes] = await Promise.all([
            dataBlobPromise,
            regionBlobPromise,
            missingPromise
        ]);

        const dataJson = JSON.parse(await dataBlob.text());
        const regionJson = JSON.parse(await regionBlob.text());

        const missingItems = new Set();
        if (missingRes.ok) {
            const missingText = await missingRes.text();
            const lines = missingText.split('\n');
            lines.forEach(line => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const catId = parts[0].trim();
                    const itemId = parts[1].trim();
                    if (catId && itemId && catId !== 'CategoryID') {
                        missingItems.add(`${catId}_${itemId}`);
                    }
                }
            });
        }

        const regionData = regionJson.data || [];
        setState('regionData', regionData);

        const regionIdMap = {};
        const regionMetaInfo = {};
        const reverseRegionMap = {};

        const totalBounds = L.latLngBounds([]);

        if (regionData && Array.isArray(regionData)) {
            regionData.forEach(region => {
                regionIdMap[region.id] = region.title;
                regionMetaInfo[region.title] = {
                    lat: parseFloat(region.latitude),
                    lng: parseFloat(region.longitude),
                    zoom: region.zoom || 12
                };

                reverseRegionMap[region.title] = region.title;
                const translatedTitle = t(region.title);
                if (translatedTitle) {
                    reverseRegionMap[translatedTitle] = region.title;
                }

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

        mapData.items = rawItems
            .filter(item => !missingItems.has(`${item.category_id}_${item.id}`))
            .map(item => {
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
                    if (transData.region) {
                        item.forceRegion = reverseRegionMap[transData.region] || transData.region;
                    }
                    if (transData.image) {
                        item.images = Array.isArray(transData.image) ? transData.image : [transData.image];
                    }
                    if (transData.video) {
                        item.video_url = transData.video;
                    }
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

        const currentMapRegions = new Set();
        regionData.forEach(r => currentMapRegions.add(r.title));
        mapData.items.forEach(i => {
            if (i.region) currentMapRegions.add(i.region);
        });

        setState('uniqueRegions', currentMapRegions);

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

        const validCategoryIds = new Set(state.mapData.categories.map(c => c.id));

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
            } else if (state.mapData.categories.length > 0) {
                state.activeCategoryIds.add(state.mapData.categories[0].id);
            }
        }

        const filteredSavedRegs = savedRegs.filter(r => state.uniqueRegions.has(r));

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
        return true;
    } catch (error) {
        console.error("데이터 로드 실패:", error);
        alert(`${config.name} 데이터를 불러오는데 실패했습니다.\n` + error.message);
        return false;
    }
};

export const saveFilterState = () => {
    localStorage.setItem(`wwm_active_cats_${state.currentMapKey}`, JSON.stringify([...state.activeCategoryIds]));
    localStorage.setItem(`wwm_active_regs_${state.currentMapKey}`, JSON.stringify([...state.activeRegionNames]));
};
