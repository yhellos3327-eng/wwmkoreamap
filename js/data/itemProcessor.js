// @ts-check
/**
 * @fileoverview Shared item processing utilities.
 * This module contains pure functions that can be used in both main thread and web workers.
 * IMPORTANT: Do NOT import state, window, document or any browser-specific APIs here.
 * @module data/itemProcessor
 */

/**
 * @typedef {Object} RawItem
 * @property {string|number} id
 * @property {string|number} category_id
 * @property {string} [title]
 * @property {string} [description]
 * @property {number|string} latitude
 * @property {number|string} longitude
 * @property {number} [regionId]
 * @property {string} [image]
 * @property {string[]} [images]
 * @property {string|string[]} [video_url]
 * @property {boolean} [isTranslated]
 */

/**
 * @typedef {Object} ProcessedItem
 * @property {string|number} id
 * @property {string} category
 * @property {string} name
 * @property {string} description
 * @property {number|string} x
 * @property {number|string} y
 * @property {string} region
 * @property {string[]} images
 * @property {number} imageSizeW
 * @property {number} imageSizeH
 * @property {boolean} isTranslated
 * @property {undefined|string|string[]} video_url - Explicitly undefined to ignore original video_url, or set by translation
 * @property {string} [forceRegion] - Force override region from translation
 * @property {boolean} [hasCustomPosition] - Whether position was overridden by translation
 */

/**
 * Extracts image list from a raw item.
 * @param {RawItem} item - The raw item.
 * @returns {string[]} Array of image URLs.
 */
export const extractImageList = (item) => {
    if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        return item.images;
    } else if (item.image) {
        return [item.image];
    }
    return [];
};

/**
 * Creates a processed item from a raw item.
 * This is a pure function with no external dependencies.
 * @param {RawItem} item - The raw item from data.json/data2.json.
 * @param {string} catId - The category ID as string.
 * @param {string} regionName - The region name.
 * @param {string[]} imgList - The image list.
 * @returns {ProcessedItem} The processed item.
 */
export const createProcessedItem = (item, catId, regionName, imgList) => {
    return {
        ...item,
        id: item.id,
        category: catId,
        name: item.title ?? "Unknown",
        description: item.description ?? "",
        x: item.latitude,
        y: item.longitude,
        region: regionName,
        images: imgList,
        imageSizeW: 44,
        imageSizeH: 44,
        isTranslated: item.isTranslated ?? false,
        // Ignore original video_url from data.json/data2.json
        // Only use translated video from translation.csv (applied later by applyItemTranslations)
        video_url: undefined,
    };
};

/**
 * Default category names mapping.
 * @type {Object.<string, string>}
 */
export const CATEGORY_DEFAULT_NAMES = {
    17310010006: "상자 (지상)",
    17310010007: "상자 (지하)",
    17310010012: "곡경심유 (파랑나비)",
    17310010015: "만물의 울림 (노랑나비)",
    17310010090: "야외 제사 (빨간나비)",
};

/**
 * Applies translations to a processed item.
 * This is a pure function - all dependencies passed as parameters.
 * @param {ProcessedItem} item - The processed item to modify (mutates in place).
 * @param {Object} categoryItemTranslations - Translation data by category.
 * @param {Object.<string, string>} reverseRegionMap - Map for reverse region lookups.
 * @param {Object.<string, string>} [defaultDescriptions={}] - Default descriptions.
 */
export const applyItemTranslations = (
    item,
    categoryItemTranslations,
    reverseRegionMap,
    defaultDescriptions = {}
) => {
    const catTrans = categoryItemTranslations[item.category];
    let commonDesc = null;

    if (catTrans && catTrans._common_description) {
        commonDesc = catTrans._common_description;
    }

    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(item.name);
    if (CATEGORY_DEFAULT_NAMES[item.category] && !hasKorean) {
        item.name = CATEGORY_DEFAULT_NAMES[item.category];
        item.isTranslated = true;
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
                // If image is "null" string, remove all images
                if (transData.image === "null" || transData.image === null) {
                    item.images = [];
                } else {
                    item.images = Array.isArray(transData.image)
                        ? transData.image
                        : [transData.image];
                }
            }
            if (transData.video) {
                item.video_url = transData.video;
            }
            if (transData.customPosition) {
                item.x = transData.customPosition.x;
                item.y = transData.customPosition.y;
                item.hasCustomPosition = true;
            }
        }
    }

    // Apply default description if none set
    if (!item.description || item.description.trim() === "") {
        if (defaultDescriptions && defaultDescriptions[item.name]) {
            item.description = defaultDescriptions[item.name];
        } else if (commonDesc) {
            item.description = commonDesc;
        }
    }
};

/**
 * Creates category objects from a list of items.
 * @param {ProcessedItem[]} items - The processed items.
 * @returns {{id: string, name: string, image: string}[]} Array of category objects.
 */
export const createCategories = (items) => {
    const uniqueCategoryIds = new Set(items.map((i) => i.category));
    return Array.from(uniqueCategoryIds).map((catId) => ({
        id: catId,
        name: catId,
        image: `./icons/${catId}.png`,
    }));
};

/**
 * Groups items by category.
 * @param {ProcessedItem[]} items - The processed items.
 * @returns {Object.<string, ProcessedItem[]>} Items grouped by category.
 */
export const groupItemsByCategory = (items) => {
    /** @type {Object.<string, ProcessedItem[]>} */
    const itemsByCategory = {};
    items.forEach((item) => {
        itemsByCategory[item.category] ??= [];
        itemsByCategory[item.category].push(item);
    });
    return itemsByCategory;
};

/**
 * Processes region data (core logic, no external dependencies).
 * @param {Object} regionJson - The raw region JSON.
 * @param {Object.<string, string>} [koDict={}] - Translation dictionary for region titles.
 * @returns {{regionData: any[], regionIdMap: Object, regionMetaInfo: Object, reverseRegionMap: Object, boundsCoords: number[][]}}
 */
export const processRegionDataCore = (regionJson, koDict = {}) => {
    const regionData = regionJson.data || [];
    const regionIdMap = {};
    const regionMetaInfo = {};
    const reverseRegionMap = {};
    const boundsCoords = [];

    if (regionData && Array.isArray(regionData)) {
        regionData.forEach((region) => {
            regionIdMap[region.id] = region.title;
            regionMetaInfo[region.title] = {
                lat: parseFloat(region.latitude),
                lng: parseFloat(region.longitude),
                zoom: region.zoom ?? 12,
            };

            reverseRegionMap[region.title] = region.title;
            const translatedTitle = koDict[region.title];
            if (translatedTitle) {
                reverseRegionMap[translatedTitle] = region.title;
            }

            if (region.coordinates && region.coordinates.length > 0) {
                const coords = region.coordinates.map((c) => [
                    parseFloat(c[1]),
                    parseFloat(c[0]),
                ]);
                boundsCoords.push(...coords);
            }
        });
    }

    return {
        regionData,
        regionIdMap,
        regionMetaInfo,
        reverseRegionMap,
        boundsCoords,
    };
};

/**
 * Processes raw items into map data (core logic).
 * @param {any[]} rawItems - Raw map items.
 * @param {Object.<number, string>} regionIdMap - Map of region IDs to names.
 * @param {Set<string>} missingItems - Set of missing item IDs to filter out.
 * @param {Object} categoryItemTranslations - Translation data by category.
 * @param {Object.<string, string>} reverseRegionMap - Map for reverse region lookups.
 * @param {Object.<string, string>} [defaultDescriptions={}] - Default descriptions.
 * @returns {{mapData: {categories: any[], items: ProcessedItem[]}, itemsByCategory: Object.<string, ProcessedItem[]>}}
 */
export const processMapDataCore = (
    rawItems,
    regionIdMap,
    missingItems,
    categoryItemTranslations,
    reverseRegionMap,
    defaultDescriptions = {}
) => {
    const mapData = { categories: [], items: [] };

    // Step 1: Filter and create processed items
    mapData.items = rawItems
        .filter((item) => !missingItems.has(`${item.category_id}_${item.id}`))
        .map((item) => {
            const catId = String(item.category_id);
            const regionName = regionIdMap[item.regionId] ?? "알 수 없음";
            const imgList = extractImageList(item);
            return createProcessedItem(item, catId, regionName, imgList);
        });

    // Step 2: Create categories
    mapData.categories = createCategories(mapData.items);

    // Step 3: Apply translations
    mapData.items.forEach((item) => {
        applyItemTranslations(
            item,
            categoryItemTranslations,
            reverseRegionMap,
            defaultDescriptions
        );
    });

    // Step 4: Group by category
    const itemsByCategory = groupItemsByCategory(mapData.items);

    return { mapData, itemsByCategory };
};
