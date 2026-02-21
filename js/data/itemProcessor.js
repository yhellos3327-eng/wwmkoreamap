// @ts-check
/**
 * 공유 아이템 처리 유틸리티.
 * 이 모듈은 메인 스레드와 웹 워커 모두에서 사용할 수 있는 순수 함수들을 포함합니다.
 * 중요: 여기에서 state, window, document 또는 브라우저 전용 API를 임포트하지 마십시오.
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
 * 원본 아이템에서 이미지 리스트를 추출합니다.
 * @param {RawItem} item - 원본 아이템.
 * @returns {string[]} 이미지 URL 배열.
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
 * 원본 아이템에서 처리된 아이템을 생성합니다.
 * 외부 의존성이 없는 순수 함수입니다.
 * @param {RawItem} item - data.json/data2.json의 원본 아이템.
 * @param {string} catId - 문자열 형태의 카테고리 ID.
 * @param {string} regionName - 지역 이름.
 * @param {string[]} imgList - 이미지 리스트.
 * @returns {ProcessedItem} 처리된 아이템.
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
        video_url: undefined,
    };
};

/**
 * 기본 카테고리 이름 매핑.
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
 * 처리된 아이템에 번역을 적용합니다.
 * 순수 함수이며, 모든 의존성은 매개변수로 전달됩니다.
 * @param {ProcessedItem} item - 수정할 처리된 아이템 (직접 수정됨).
 * @param {Object} categoryItemTranslations - 카테고리별 번역 데이터.
 * @param {Object.<string, string>} reverseRegionMap - 역방향 지역 조회를 위한 맵.
 * @param {Object.<string, string>} [defaultDescriptions={}] - 기본 설명 설정.
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

    // 설정된 설명이 없는 경우 기본 설명 적용
    if (!item.description || item.description.trim() === "") {
        if (defaultDescriptions && defaultDescriptions[item.name]) {
            item.description = defaultDescriptions[item.name];
        } else if (commonDesc) {
            item.description = commonDesc;
        }
    }
};

/**
 * 아이템 리스트에서 카테고리 객체들을 생성합니다.
 * @param {ProcessedItem[]} items - 처리된 아이템 배열.
 * @returns {{id: string, name: string, image: string}[]} 카테고리 객체 배열.
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
 * 아이템을 카테고리별로 그룹화합니다.
 * @param {ProcessedItem[]} items - 처리된 아이템 배열.
 * @returns {Object.<string, ProcessedItem[]>} 카테고리별로 그룹화된 아이템.
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
 * 지역 데이터를 처리합니다 (순수 로직, 외부 의존성 없음).
 * @param {Object} regionJson - 원본 지역 JSON.
 * @param {Object.<string, string>} [koDict={}] - 지역 타이틀을 위한 번역 사전.
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
 * 원본 아이템들을 지도 데이터로 처리합니다 (핵심 로직).
 * @param {any[]} rawItems - 원본 지도 아이템 배열.
 * @param {Object.<number, string>} regionIdMap - 지역 ID와 이름 매핑.
 * @param {Set<string>} missingItems - 걸러낼 누락된 아이템 ID 세트.
 * @param {Object} categoryItemTranslations - 카테고리별 번역 데이터.
 * @param {Object.<string, string>} reverseRegionMap - 역방향 지역 조회를 위한 맵.
 * @param {Object.<string, string>} [defaultDescriptions={}] - 기본 설명 설정.
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
