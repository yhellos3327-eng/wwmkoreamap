import { state, setState } from '../state.js';
import { t } from '../utils.js';
import { webWorkerManager } from '../web-worker-manager.js';

export const USE_WORKERS = true;

export const processRegionDataSync = (regionJson) => {
    const regionData = regionJson.data || [];
    const regionIdMap = {};
    const regionMetaInfo = {};
    const reverseRegionMap = {};
    const boundsCoords = [];

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
            boundsCoords.push(...coords);
        }
    });

    return { regionData, regionIdMap, regionMetaInfo, reverseRegionMap, boundsCoords };
};

export const processRegionData = async (regionJson) => {
    if (USE_WORKERS && webWorkerManager.isSupported) {
        return webWorkerManager.processRegionData(regionJson, state.koDict);
    }
    return processRegionDataSync(regionJson);
};

const applyTranslations = (item, reverseRegionMap) => {
    const catTrans = state.categoryItemTranslations[item.category];
    let commonDesc = null;

    if (catTrans && catTrans._common_description) {
        commonDesc = catTrans._common_description;
    }

    // 카테고리별 기본 이름 설정 (번역 개별 오버라이드가 없으면 이 이름 사용)
    const categoryDefaultNames = {
        '17310010006': '상자 (지상)',
        '17310010007': '상자 (지하)',
        '17310010012': '곡경심유 (파랑나비)',
        '17310010015': '만물의 울림 (노랑나비)',
        '17310010090': '야외 제사 (빨간나비)'
    };

    if (categoryDefaultNames[item.category]) {
        item.name = categoryDefaultNames[item.category];
        item.isTranslated = true;
    }

    if (catTrans) {
        let transData = catTrans[item.id];
        if (!transData && item.name) {
            transData = catTrans[item.name];
        }

        if (transData) {
            // 번역 데이터에 개별 이름이 있으면 오버라이드
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
            // Apply custom position override [x|y] format
            if (transData.customPosition) {
                item.x = transData.customPosition.x;
                item.y = transData.customPosition.y;
                item.hasCustomPosition = true;
            }
        }
    }

    if ((!item.description || item.description.trim() === "") && commonDesc) {
        item.description = commonDesc;
    }
};

export const processMapDataSync = (rawItems, regionIdMap, missingItems, reverseRegionMap) => {
    const mapData = { categories: [], items: [] };
    const itemsByCategory = {};

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
                isTranslated: item.isTranslated || false

            };
        });

    const uniqueCategoryIds = new Set(mapData.items.map(i => i.category));
    mapData.categories = Array.from(uniqueCategoryIds).map(catId => ({
        id: catId,
        name: catId,
        image: `./icons/${catId}.png`
    }));

    mapData.items.forEach(item => {
        applyTranslations(item, reverseRegionMap);

        if (!itemsByCategory[item.category]) {
            itemsByCategory[item.category] = [];
        }
        itemsByCategory[item.category].push(item);
    });

    return { mapData, itemsByCategory };
};

export const processMapData = async (rawItems, regionIdMap, missingItems, reverseRegionMap) => {
    if (USE_WORKERS && webWorkerManager.isSupported) {
        return webWorkerManager.processMapData(
            rawItems,
            regionIdMap,
            missingItems,
            state.categoryItemTranslations,
            reverseRegionMap
        );
    }
    return processMapDataSync(rawItems, regionIdMap, missingItems, reverseRegionMap);
};

export const parseMissingItems = async (missingRes) => {
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

    return missingItems;
};

export const parseJSONData = async (dataBlob, regionBlob) => {
    if (USE_WORKERS && webWorkerManager.isSupported) {
        const dataText = await dataBlob.text();
        const regionText = await regionBlob.text();

        const [dataJson, regionJson] = await Promise.all([
            webWorkerManager.parseJSON(dataText),
            webWorkerManager.parseJSON(regionText)
        ]);

        return { dataJson, regionJson };
    }

    return {
        dataJson: JSON.parse(await dataBlob.text()),
        regionJson: JSON.parse(await regionBlob.text())
    };
};

export const sortItemsByCategory = (itemsByCategory) => {
    for (const key in itemsByCategory) {
        itemsByCategory[key].sort((a, b) => t(a.name).localeCompare(t(b.name)));
    }
};

export const collectUniqueRegions = (regionData, mapDataItems) => {
    const regions = new Set();
    regionData.forEach(r => regions.add(r.title));
    mapDataItems.forEach(i => {
        // forceRegion(번역 데이터에서 강제 할당된 지역)도 포함
        const effectiveRegion = i.forceRegion || i.region;
        if (effectiveRegion) regions.add(effectiveRegion);
    });
    return regions;
};

export const parseCSVData = async (csvRes) => {
    if (!csvRes || !csvRes.ok) return [];
    const text = await csvRes.text();
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return [];

    const headerLine = lines.shift();
    const headers = headerLine.split(',').map(h => h.trim());

    const items = [];
    lines.forEach(line => {
        if (!line.trim()) return;

        // Simple CSV parse for markers
        const parts = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
                parts.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current);

        if (parts.length < 6) return;

        const item = {};
        headers.forEach((h, idx) => {
            item[h] = parts[idx]?.trim();
        });

        // Map CSV fields to JSON fields
        // regionId can be numeric ID or string region name
        const regionIdRaw = item.regionId;
        const regionIdNum = parseInt(regionIdRaw);
        const isNumericRegion = !isNaN(regionIdNum) && String(regionIdNum) === regionIdRaw;

        const processedItem = {
            id: item.id,
            category_id: item.category_id,
            title: item.title,
            description: item.description || "",
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            regionId: isNumericRegion ? regionIdNum : 0,
            image: item.image || "",
            video_url: item.video_url || "",
            images: item.image ? [item.image] : [],
            isTranslated: true
        };

        // If regionId is a string region name, set forceRegion
        if (!isNumericRegion && regionIdRaw) {
            processedItem.forceRegion = regionIdRaw;
        }


        if (!isNaN(processedItem.latitude) && !isNaN(processedItem.longitude)) {
            items.push(processedItem);
        }
    });

    return items;
};

