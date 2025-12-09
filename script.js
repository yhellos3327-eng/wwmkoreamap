const updateHistory = [
    {
        version: "v1.2.6",
        date: "2025-12-09",
        content: [
            "버그 수정"
        ]
    },
    {
        version: "v1.2.5",
        date: "2025-12-09",
        content: [
            "지도 최적화.",
            "개봉 추가"
        ]
    },
    {
        version: "v1.2",
        date: "2025-12-08",
        content: [
            "지역 경계선 표시 및 동영상 재생 기능 추가.",
            "청하 경계석 100% 한글화. (경계석 설명도 추가됨.)",
            "기술 습득 카테고리 번역중."
        ]
    },
    {
        version: "v1.1",
        date: "2025-12-08",
        content: [
            "AI 번역 기능: 설명이 없는 항목은 번역 버튼 제외",
            "초기 로딩 시 경계석만 활성화",
        ]
    },
    {
        version: "v1.0.6",
        date: "2025-12-08",
        content: [
            "중국 지도 기반으로 업데이트, 데이터가 변경된 부분들이 매우 많아 다시 번역중입니다. 많이 더뎌질수 있습니다. 그래도 기존 번역 데이터가 있기에 조금 수월할것 같습니다. 여러분들 미안합니다.. 빠르게 번역해보도록 하겠습니다.",
        ]
    },
    {
        version: "v1.0.5",
        date: "2025-12-06",
        content: [
            "청하 지역 상기, 제작대, 천공 동굴 한글화.",
        ]
    },
    {
        version: "v1.0.4",
        date: "2025-12-05",
        content: [
            "궁술 대결, 퇴마의 종, 현상금 한글화.",
        ]
    },
    {
        version: "v1.0.3",
        date: "2025-12-05",
        content: [
            "카테고리 한글화 (인게임 용어로)",
            "청하 지역 경계석, 천애객 한글화 (인게임 용어로)",
        ]
    },
    {
        version: "v1.0.2",
        date: "2025-12-05",
        content: [
            "지도 렌더링 최적화",
            "데이터 로딩 구조 개선",
        ]
    },
    { version: "v1.0.1", date: "2025-12-05", content: ["지역별 필터링 추가", "일괄 토글 버튼 추가"] },
    { version: "v1.0.0", date: "2025-12-05", content: ["한국어 지도 오픈"] }
];

const usefulLinks = [
    { title: "공식 홈페이지", url: "https://www.wherewindsmeetgame.com/kr/index.html" },
    { title: "기반 위키 (Wiki)", url: "https://wherewindsmeet.wiki.fextralife.com/" },
    { title: "연운: 한국 위키", url: "https://wwm.tips/" },
    { title: "연운 공식 디스코드", url: "https://discord.gg/wherewindsmeet" },
    { title: "연운 한국 디스코드", url: "https://discord.gg/wherewindsmeetkr" },
    { title: "아카라이브 연운 채널", url: "https://arca.live/b/wherewindsmeet" },
    { title: "디씨 연운 갤러리", url: "https://gall.dcinside.com/wherewindsmeets" },
    { title: "디씨 개봉(연운) 갤러리", url: "https://gall.dcinside.com/dusdns" },
];

const contributionLinks = [
    { titleKey: "github_repository", url: "https://github.com/yhellos3327-eng/wwmkoreamap", icon: "code" },
    { titleKey: "data_submission", url: "https://github.com/yhellos3327-eng/wwmkoreamap/issues", icon: "bug" },
];

const MAP_CONFIGS = {
    qinghe: {
        id: 3000,
        name: "청하 (清河)",
        tileUrl: 'https://ue.17173cdn.com/a/terra/tiles/yysls/3000_v4_uN4cS8/{z}/{y}_{x}.png',
        dataFile: './data.json',
        regionFile: './regions.json',
        minZoom: 9,
        maxZoom: 13,
        center: [0.6768, -0.6841],
        zoom: 11,
        tilePadding: 0.02
    },
    kaifeng: {
        id: 4000,
        name: "개봉 (开封)",
        tileUrl: 'https://ue.17173cdn.com/a/terra/tiles/yysls/3003_v8_65jd2/{z}/{y}_{x}.png',
        dataFile: './data2.json',
        regionFile: './regions2.json',
        minZoom: 9,
        maxZoom: 13,
        center: [0.5, -0.5],
        zoom: 11,
        tilePadding: 1.0
    }
};

let currentMapKey = 'qinghe';
let currentTileLayer = null;
let regionLayerGroup;

let map;
let allMarkers = [];
let regionData = [];
let koDict = {};
let mapData = { categories: [], items: [] };

let activeCategoryIds = new Set();
let activeRegionNames = new Set();
let uniqueRegions = new Set();
let itemsByCategory = {};
let completedList = JSON.parse(localStorage.getItem('wwm_completed')) || [];
let favorites = JSON.parse(localStorage.getItem('wwm_favorites')) || [];
let categoryItemTranslations = {};
let currentModalList = [];
let currentLightboxImages = [];
let currentLightboxIndex = 0;
let regionMetaInfo = {};
let savedApiKey = localStorage.getItem('wwm_api_key') || "";

const ICON_MAPPING = {
    "173100100592": null,
    "17310013036": null,
    "17310010091": null,
};

const t = (key) => {
    if (!key) return "";
    const trimmedKey = key.toString().trim();
    return koDict[trimmedKey] || key;
}

const getJosa = (word, type) => {
    if (!word || typeof word !== 'string') return type.split('/')[0];
    const lastChar = word.charCodeAt(word.length - 1);
    if (lastChar < 0xAC00 || lastChar > 0xD7A3) return type.split('/')[0];
    const hasJongsung = (lastChar - 0xAC00) % 28 !== 0;
    const [josa1, josa2] = type.split('/');
    return hasJongsung ? josa1 : josa2;
};

function toggleSidebar(action) {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar');

    const isEmbed = document.body.classList.contains('embed-mode');

    if (action === 'open') {
        sidebar.classList.add('open');
        sidebar.classList.remove('collapsed');
        if (openBtn) openBtn.classList.add('hidden-btn');

    } else {
        sidebar.classList.remove('open');
        sidebar.classList.add('collapsed');

        if (openBtn) openBtn.classList.remove('hidden-btn');
    }

    setTimeout(() => { if (map) map.invalidateSize(); }, 300);
}

function initCustomDropdown() {
    const customSelect = document.getElementById('custom-map-select');
    if (!customSelect) return;

    const trigger = customSelect.querySelector('.select-trigger');
    const optionsContainer = customSelect.querySelector('.select-options');
    const selectedText = customSelect.querySelector('.selected-text');

    optionsContainer.innerHTML = '';

    Object.keys(MAP_CONFIGS).forEach(key => {
        const config = MAP_CONFIGS[key];
        const optionDiv = document.createElement('div');
        optionDiv.className = `custom-option ${key === currentMapKey ? 'selected' : ''}`;
        optionDiv.dataset.value = key;
        optionDiv.textContent = config.name;

        optionDiv.addEventListener('click', async (e) => {
            e.stopPropagation();

            if (currentMapKey === key) {
                customSelect.classList.remove('open');
                return;
            }

            localStorage.removeItem('wwm_active_regs');

            currentMapKey = key;
            if (selectedText) selectedText.textContent = config.name;

            const allOptions = optionsContainer.querySelectorAll('.custom-option');
            allOptions.forEach(opt => opt.classList.remove('selected'));
            optionDiv.classList.add('selected');

            customSelect.classList.remove('open');

            await loadMapData(currentMapKey);
        });

        optionsContainer.appendChild(optionDiv);
    });

    if (MAP_CONFIGS[currentMapKey] && selectedText) {
        selectedText.textContent = MAP_CONFIGS[currentMapKey].name;
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelect.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            customSelect.classList.remove('open');
        }
    });
}

function createPopupHtml(item, lat, lng, regionName) {
    const isFav = favorites.includes(item.id);
    const isCompleted = completedList.includes(item.id);
    const displayRegion = item.forceRegion || regionName;
    let translatedName = t(item.name);
    if (translatedName) {
        translatedName = translatedName.replace(/{region}/g, displayRegion);
    }
    const categoryName = t(item.category);

    let itemDescription = item.description || '';
    let replaceName = translatedName;
    const josa = typeof getJosa === 'function' ? getJosa(translatedName, '으로/로') : '로';
    replaceName = translatedName + josa;

    if (itemDescription) {
        itemDescription = itemDescription.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--accent); text-decoration: underline;">$1</a>');
        itemDescription = itemDescription.replace(/\n/g, '<br>');
        itemDescription = itemDescription.replace(/{name}/g, replaceName);
        itemDescription = itemDescription.replace(/{region}/g, displayRegion);
    } else {
        itemDescription = '<p class="no-desc">설명 없음</p>';
    }

    let imageSliderHtml = '';
    const imgs = item.images || [];
    if (imgs.length > 0) {
        const slides = imgs.map((src, index) => {
            const activeClass = index === 0 ? 'active' : '';
            const imgSrc = src.startsWith('http') ? src : src;
            return `<img src="${imgSrc}" class="popup-image ${activeClass}" onclick="openLightbox(${item.id}, ${index})" alt="${translatedName}">`;
        }).join('');
        const navBtns = imgs.length > 1 ? `
            <button class="img-nav-btn prev" onclick="event.stopPropagation(); switchImage(this, -1)" style="display:block">❮</button>
            <button class="img-nav-btn next" onclick="event.stopPropagation(); switchImage(this, 1)" style="display:block">❯</button>
            <span class="img-counter">1 / ${imgs.length}</span>
        ` : '';
        imageSliderHtml = `
            <div class="popup-image-container" data-idx="0" data-total="${imgs.length}">
                ${slides}
                ${navBtns}
            </div>
        `;
    }

    let videoHtml = '';
    if (item.video_url && item.video_url.trim() !== "") {
        let rawUrl = item.video_url.trim();

        let videoSrc = rawUrl.replace(/^http:/, 'https:');
        if (videoSrc.startsWith('//')) {
            videoSrc = 'https:' + videoSrc;
        }

        let lightboxSrc = videoSrc;
        const separator = videoSrc.includes('?') ? '&' : '?';

        if (lightboxSrc.includes('bilibili.com')) {
            lightboxSrc = lightboxSrc.replace(/&?autoplay=\d/, '');
            lightboxSrc += `${separator}autoplay=1&high_quality=1`;
        }

        let thumbSrc = videoSrc;
        if (thumbSrc.includes('bilibili.com')) {
            thumbSrc = thumbSrc.replace(/&?autoplay=\d/, '');
            thumbSrc += `${separator}autoplay=0&t=0&danmaku=0&high_quality=1&muted=1`;
        }

        videoHtml = `
            <div class="popup-video-thumbnail" onclick="openVideoLightbox('${lightboxSrc}')" style="position:relative; width:100%; padding-bottom:56.25%; height:0; overflow:hidden; border:1px solid #444; border-radius:6px; cursor:pointer; background:#000;">
                <iframe 
                    src="${thumbSrc}" 
                    style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;" 
                    frameborder="0" 
                    scrolling="no"
                    allowfullscreen>
                </iframe>
                
                <div class="video-thumb-cover" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; z-index:2;">
                    <div class="video-play-icon" style="font-size:40px; color:white; text-shadow:0 0 10px rgba(0,0,0,0.8); opacity:0.9;"></div>
                </div>
            </div>
        `;
    }

    let translateBtnHtml = '';
    if (!item.isTranslated && item.description && item.description.trim() !== "") {
        translateBtnHtml = `
            <button class="btn-translate" onclick="translateItem(${item.id})" style="width:100%; margin-top:10px; padding:6px; background:var(--accent-bg); border:1px solid var(--accent); color:var(--accent); border-radius:4px; cursor:pointer;">
                ✨ AI 번역 (Chinese -> Korean)
            </button>
        `;
    }

    let relatedHtml = '';
    const relatedItems = itemsByCategory[item.category] || [];
    const filteredList = relatedItems.filter(i => i.id !== item.id);
    if (filteredList.length > 0) {
        const limit = 3;
        const hiddenCount = filteredList.length - limit;
        const listItemsHtml = filteredList.map((r, index) => {
            const hiddenClass = index >= limit ? 'hidden' : '';
            const rReg = r.forceRegion || r.region;
            let rName = t(r.name);
            if (rName) rName = rName.replace(/{region}/g, rReg);
            const rRegHtml = rReg ? `<span class="related-region">(${rReg})</span>` : '';
            return `<li class="related-item ${hiddenClass}" onclick="jumpToId(${r.id})">${rName} ${rRegHtml}</li>`;
        }).join('');
        const expandBtn = hiddenCount > 0
            ? `<button class="btn-expand" onclick="expandRelated(this)">▼ 더보기 (${hiddenCount}+)</button>`
            : '';
        relatedHtml = `
        <div class="popup-related">
            <div class="popup-related-header">
                <h5>관련 ${categoryName} (${filteredList.length})
                <button class="btn-search-modal" onclick="openRelatedModal('${item.category}')" title="전체 목록 검색">🔍</button></h5>
            </div>
            <ul class="related-list">${listItemsHtml}</ul>
            ${expandBtn}
        </div>
    `;
    }

    return `
    <div class="popup-container" data-id="${item.id}">
        <div class="popup-header">
            <img src="./icons/${item.category}.png" class="popup-icon" alt="${categoryName}" onerror="this.style.display='none'">
            <h4>${translatedName}</h4>
        </div>
        <div class="popup-body">
            ${imageSliderHtml}
            ${videoHtml}
            ${itemDescription.startsWith('<p') ? itemDescription : `<p>${itemDescription}</p>`}
            ${translateBtnHtml}
        </div>
        ${relatedHtml}
        <div class="popup-actions">
            <button class="action-btn btn-fav ${isFav ? 'active' : ''}" onclick="toggleFavorite(${item.id})" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
            <button class="action-btn btn-complete ${isCompleted ? 'active' : ''}" onclick="toggleCompleted(${item.id})" title="완료 상태로 표시">${isCompleted ? '완료됨' : '완료 체크'}</button>
            <button class="action-btn btn-share" onclick="shareLocation(${item.id}, ${lat}, ${lng})" title="위치 공유">📤</button>
        </div>
        <div class="popup-footer">
            <span class="badge">${categoryName}</span>
            <span class="badge" style="margin-left:5px;">${t(displayRegion)}</span>
        </div>
    </div>
`;
}

function initMap(mapKey) {
    const config = MAP_CONFIGS[mapKey];
    if (!config) return;

    if (!map) {
        map = L.map('map', {
            center: config.center,
            zoom: config.zoom,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            zoomControl: false,
            attributionControl: false,
            maxBoundsViscosity: 1.0,
            preferCanvas: true
        });
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        map.on('moveend', updateMapVisibility);
        map.on('zoomend', updateMapVisibility);
        map.on('click', () => { if (window.innerWidth <= 768) toggleSidebar('close'); });
    } else {
        map.setView(config.center, config.zoom);
    }

    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }
    currentTileLayer = L.tileLayer(config.tileUrl, {
        tms: false,
        noWrap: true,
        tileSize: 256,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
    }).addTo(map);

    if (regionLayerGroup) {
        regionLayerGroup.clearLayers();
    } else {
        regionLayerGroup = L.layerGroup().addTo(map);
    }
}

async function loadMapData(mapKey) {
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

        regionData = regionJson.data || [];

        const regionIdMap = {};
        regionMetaInfo = {};

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

        if (totalBounds.isValid()) {
            map.setMaxBounds(totalBounds.pad(0.85));
            map.options.minZoom = config.minZoom;

            if (currentTileLayer) {
                const padding = (config.tilePadding !== undefined) ? config.tilePadding : 0.1;
                currentTileLayer.options.bounds = totalBounds.pad(padding);
                currentTileLayer.redraw();
            }
        }

        const rawItems = dataJson.data || [];
        itemsByCategory = {};

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
            const catTrans = categoryItemTranslations[item.category];
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

        const favStorageKey = `wwm_favorites_${mapKey}`;
        favorites = JSON.parse(localStorage.getItem(favStorageKey)) || [];

        if (mapKey === 'qinghe' && favorites.length === 0) {
            const oldFavs = JSON.parse(localStorage.getItem('wwm_favorites'));
            if (oldFavs && oldFavs.length > 0) {
                favorites = oldFavs;
                localStorage.setItem(favStorageKey, JSON.stringify(favorites));
            }
        }

        const DEFAULT_CAT_ID = "17310010083";
        let savedCats = JSON.parse(localStorage.getItem('wwm_active_cats')) || [];
        let savedRegs = JSON.parse(localStorage.getItem('wwm_active_regs')) || [];

        const validCategoryIds = new Set(mapData.categories.map(c => c.id));
        const filteredSavedCats = savedCats.filter(id => validCategoryIds.has(id));

        activeCategoryIds.clear();

        if (filteredSavedCats.length > 0) {
            filteredSavedCats.forEach(id => activeCategoryIds.add(id));
        } else {
            if (validCategoryIds.has(DEFAULT_CAT_ID)) {
                activeCategoryIds.add(DEFAULT_CAT_ID);
            } else if (mapData.categories.length > 0) {
                activeCategoryIds.add(mapData.categories[0].id);
            }
        }

        const currentMapRegions = new Set();
        regionData.forEach(r => currentMapRegions.add(r.title));
        mapData.items.forEach(i => {
            if (i.region) currentMapRegions.add(i.region);
        });

        uniqueRegions = currentMapRegions;

        const filteredSavedRegs = savedRegs.filter(r => currentMapRegions.has(r));

        activeRegionNames.clear();

        if (filteredSavedRegs.length > 0) {
            filteredSavedRegs.forEach(r => activeRegionNames.add(r));
        } else {
            uniqueRegions.forEach(r => activeRegionNames.add(r));
        }

        saveFilterState();

        renderMapDataAndMarkers();
        refreshCategoryList();
        updateToggleButtonsState();
        renderFavorites();

    } catch (error) {
        console.error("데이터 로드 실패:", error);
        alert(`${config.name} 데이터를 불러오는데 실패했습니다.\n` + error.message);
    }
}

function refreshCategoryList() {
    const categoryListEl = document.getElementById('category-list');
    categoryListEl.innerHTML = '';

    const validCategories = mapData.categories.filter(cat => {
        return cat.image && cat.image.trim() !== "";
    });

    const categoryGroups = {
        "locations": {
            title: "지점",
            ids: ["17310010083", "17310010084", "17310010019", "17310010085", "17310010086", "17310010087", "17310010088"]
        },
        "exploration": {
            title: "탐색 & 중생",
            ids: ["17310010001", "17310010002", "17310010006", "17310010007", "17310010004", "17310010008", "17310010012", "17310010015", "17310010090", "17310010092", "17310010009", "17310010010", "17310010081", "17310010005", "17310010003", "17310010011", "17310010013", "17310010014", "17310010016", "17310010017", "17310010018", "17310010079", "17310010080", "17310010089", "17310010082"]
        },
        "collections": {
            title: "박물지",
            ids: ["17310010020", "17310010021", "17310010022", "17310010023", "17310010024", "17310010025", "17310010026", "17310010027", "17310010028", "17310010029", "17310010030", "17310010031", "17310010032", "17310010033", "17310010034", "17310010035"]
        }
    };

    for (const [groupKey, groupInfo] of Object.entries(categoryGroups)) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'category-group';

        const groupTitle = document.createElement('h3');
        groupTitle.className = 'group-name';
        groupTitle.textContent = groupInfo.title;
        groupDiv.appendChild(groupTitle);

        const cateListDiv = document.createElement('div');
        cateListDiv.className = 'cate-list';

        const groupCategories = validCategories.filter(cat => groupInfo.ids.includes(cat.id));

        groupCategories.sort((a, b) => t(a.name).localeCompare(t(b.name), 'ko'));

        groupCategories.forEach(cat => {
            const btn = document.createElement('div');
            btn.className = activeCategoryIds.has(cat.id) ? 'cate-item active' : 'cate-item';
            btn.dataset.id = cat.id;

            const count = itemsByCategory[cat.id] ? itemsByCategory[cat.id].length : 0;

            btn.innerHTML = `
                <span class="cate-icon"><img src="${cat.image}" alt=""></span>
                <span class="cate-name">${t(cat.name)}</span>
                <span class="cate-count">${count}</span>
            `;

            btn.addEventListener('click', () => {
                if (activeCategoryIds.has(cat.id)) {
                    activeCategoryIds.delete(cat.id);
                    btn.classList.remove('active');
                } else {
                    activeCategoryIds.add(cat.id);
                    btn.classList.add('active');
                    if (activeRegionNames.size === 0) setAllRegions(true);
                }
                updateMapVisibility();
                updateToggleButtonsState();
                saveFilterState();
            });
            cateListDiv.appendChild(btn);
        });

        if (groupCategories.length > 0) {
            groupDiv.appendChild(cateListDiv);
            categoryListEl.appendChild(groupDiv);
        }
    }

    updateToggleButtonsState();
}

function renderMapDataAndMarkers() {
    allMarkers.forEach(m => {
        if (map.hasLayer(m.marker)) map.removeLayer(m.marker);
    });
    allMarkers = [];

    const currentConfig = MAP_CONFIGS[currentMapKey];

    const filteredItems = mapData.items;

    const filteredRegions = regionData;

    const regionPolygons = [];

    if (regionLayerGroup) {
        regionLayerGroup.clearLayers();
    }

    if (filteredRegions && Array.isArray(filteredRegions)) {
        filteredRegions.forEach(region => {
            if (!region.coordinates || region.coordinates.length === 0) return;

            const polygonCoords = region.coordinates.map(coord => [parseFloat(coord[1]), parseFloat(coord[0])]);
            const translatedRegionName = t(region.title);

            regionPolygons.push({
                title: region.title,
                coords: polygonCoords
            });

            const polygon = L.polygon(polygonCoords, {
                color: '#daac71',
                weight: 2,
                opacity: 0.5,
                fillColor: '#daac71',
                fillOpacity: 0.05,
                className: 'region-polygon'
            });

            polygon.bindTooltip(translatedRegionName, {
                permanent: true,
                direction: 'center',
                className: 'region-label'
            });

            polygon.on('mouseover', function () {
                this.setStyle({ weight: 3, fillOpacity: 0.15 });
            });
            polygon.on('mouseout', function () {
                this.setStyle({ weight: 2, fillOpacity: 0.05 });
            });
            polygon.on('click', function (e) {
                L.DomEvent.stopPropagation(e);
                map.fitBounds(this.getBounds());
            });

            polygon.on('contextmenu', function (e) {
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);

                activeRegionNames.clear();
                activeRegionNames.add(region.title);

                const regBtns = document.querySelectorAll('#region-list .cate-item');
                regBtns.forEach(btn => {
                    if (btn.dataset.region === region.title) {
                        btn.classList.add('active');
                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        btn.classList.remove('active');
                    }
                });

                updateToggleButtonsState();
                updateMapVisibility();
                saveFilterState();
            });

            regionLayerGroup.addLayer(polygon);
        });
    }

    uniqueRegions.clear();

    filteredItems.forEach(item => {
        let catId = item.category;

        if (typeof ICON_MAPPING !== 'undefined' && ICON_MAPPING.hasOwnProperty(catId)) {
            const mappedValue = ICON_MAPPING[catId];
            if (mappedValue === null) {
                return;
            }
            catId = mappedValue;
        }

        const lat = parseFloat(item.x);
        const lng = parseFloat(item.y);

        let finalRegionName = item.region || "알 수 없음";
        let physicallyInRegion = null;

        for (const polyObj of regionPolygons) {
            if (isPointInPolygon([lat, lng], polyObj.coords)) {
                physicallyInRegion = polyObj.title;
                break;
            }
        }

        if (physicallyInRegion) {
            finalRegionName = physicallyInRegion;
            item.region = physicallyInRegion;
            item.forceRegion = physicallyInRegion;
        }

        if (finalRegionName) uniqueRegions.add(finalRegionName);

        const categoryObj = mapData.categories.find(c => c.id === catId);

        let iconUrl = './icons/marker.png';
        if (categoryObj && categoryObj.image) {
            iconUrl = categoryObj.image;
        } else if (typeof DEFAULT_ICON_PATH !== 'undefined') {
            iconUrl = DEFAULT_ICON_PATH;
        }

        const w = item.imageSizeW || 44;
        const h = item.imageSizeH || 44;
        const isCompleted = completedList.includes(item.id);
        const iconClass = isCompleted ? 'game-marker-icon completed-marker' : 'game-marker-icon marker-anim';

        const customIcon = L.icon({
            iconUrl: iconUrl,
            iconSize: [w, h],
            iconAnchor: [w / 2, h / 2],
            popupAnchor: [0, -h / 2],
            className: iconClass
        });

        const marker = L.marker([lat, lng], {
            icon: customIcon,
            title: item.name,
            alt: catId,
            itemId: item.id
        });

        marker.on('click', () => {
            console.group(`📍 [${item.id}] ${item.name}`);
            console.log(`Category: ${catId} (Original: ${item.category})`);
            console.log(`Region: ${finalRegionName}`);
            console.groupEnd();
        });

        marker.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            if (marker.isPopupOpen()) marker.closePopup();
            window.toggleCompleted(item.id);
        });

        marker.bindPopup(() => createPopupHtml(item, lat, lng, finalRegionName));

        allMarkers.push({
            id: item.id,
            marker: marker,
            name: item.name.toLowerCase(),
            originalName: item.name,
            desc: (item.description || '').toLowerCase(),
            category: catId,
            region: finalRegionName,
            forceRegion: item.forceRegion
        });
    });

    refreshSidebarLists();
    updateMapVisibility();
}

function refreshSidebarLists() {
    const regionListEl = document.getElementById('region-list');
    regionListEl.innerHTML = '';

    const sortedRegions = Array.from(uniqueRegions).sort((a, b) => t(a).localeCompare(t(b), 'ko'));
    const regionIconUrl = './icons/17310010083.png';
    regionListEl.className = 'cate-list';

    sortedRegions.forEach(region => {
        const btn = document.createElement('div');
        btn.className = activeRegionNames.has(region) ? 'cate-item active' : 'cate-item';
        btn.dataset.region = region;

        const count = allMarkers.filter(m => m.region === region).length;
        const translatedName = t(region);

        btn.innerHTML = `
            <span class="cate-icon"><img src="${regionIconUrl}" alt="Region"></span>
            <span class="cate-name">${translatedName}</span>
            <span class="cate-count">${count}</span>
        `;

        btn.addEventListener('click', (e) => {
            if (activeRegionNames.has(region)) {
                activeRegionNames.delete(region);
                btn.classList.remove('active');
            } else {
                activeRegionNames.add(region);
                btn.classList.add('active');
                if (activeCategoryIds.size === 0) setAllCategories(true);
            }
            updateToggleButtonsState();
            updateMapVisibility();
            saveFilterState();

            const meta = regionMetaInfo[region];
            if (meta) {
                map.flyTo([meta.lat, meta.lng], meta.zoom, {
                    animate: true,
                    duration: 1.0
                });
            }
        });
        regionListEl.appendChild(btn);
    });

    activeRegionNames.clear();
    uniqueRegions.forEach(r => activeRegionNames.add(r));
    updateToggleButtonsState();
}

function updateMapVisibility() {
    if (!map) return;
    const bounds = map.getBounds().pad(0.2);
    allMarkers.forEach(m => {
        const isCatActive = activeCategoryIds.has(m.category);
        const isRegActive = activeRegionNames.has(m.region);
        if (isCatActive && isRegActive) {
            const isVisible = bounds.contains(m.marker.getLatLng());
            const isOnMap = map.hasLayer(m.marker);
            if (isVisible) {
                if (!isOnMap) map.addLayer(m.marker);
            } else {
                if (isOnMap) map.removeLayer(m.marker);
            }
        } else {
            if (map.hasLayer(m.marker)) map.removeLayer(m.marker);
        }
    });
}

function setAllCategories(isActive) {
    const catBtns = document.querySelectorAll('#category-list .cate-item');
    activeCategoryIds.clear();
    const validCategories = mapData.categories.filter(cat => cat.image && cat.image.trim() !== "");

    if (isActive) {
        validCategories.forEach(c => activeCategoryIds.add(c.id));
        catBtns.forEach(btn => btn.classList.add('active'));
    } else {
        catBtns.forEach(btn => btn.classList.remove('active'));
    }
    updateToggleButtonsState();
    updateMapVisibility();
    saveFilterState();
}

function setAllRegions(isActive) {
    const regBtns = document.querySelectorAll('#region-list .cate-item');
    activeRegionNames.clear();
    if (isActive) {
        uniqueRegions.forEach(r => activeRegionNames.add(r));
        regBtns.forEach(btn => btn.classList.add('active'));
    } else {
        regBtns.forEach(btn => btn.classList.remove('active'));
    }
    updateToggleButtonsState();
    updateMapVisibility();
    saveFilterState();
}

function updateToggleButtonsState() {
    const btnToggleCat = document.getElementById('btn-toggle-cat');
    const btnToggleReg = document.getElementById('btn-toggle-reg');
    const validCategories = mapData.categories.filter(cat => cat.image && cat.image.trim() !== "");

    if (btnToggleCat) {
        const allCatActive = activeCategoryIds.size === validCategories.length;
        btnToggleCat.innerHTML = allCatActive ? '👁️ 모두 끄기' : '👁️‍🗨️ 모두 켜기';
        btnToggleCat.classList.toggle('off', !allCatActive);
    }
    if (btnToggleReg) {
        const allRegActive = activeRegionNames.size === uniqueRegions.size;
        btnToggleReg.innerHTML = allRegActive ? '👁️ 모두 끄기' : '👁️‍🗨️ 모두 켜기';
        btnToggleReg.classList.toggle('off', !allRegActive);
    }
}

function saveFilterState() {
    localStorage.setItem('wwm_active_cats', JSON.stringify([...activeCategoryIds]));
    localStorage.setItem('wwm_active_regs', JSON.stringify([...activeRegionNames]));
}

function renderFavorites() {
    const favListEl = document.getElementById('favorite-list');
    favListEl.innerHTML = '';
    if (favorites.length === 0) {
        favListEl.innerHTML = '<p class="empty-msg">즐겨찾기한 항목이 없습니다.</p>';
        return;
    }
    favorites.forEach(favId => {
        const item = mapData.items.find(i => i.id === favId);
        if (item) {
            const div = document.createElement('div');
            div.className = 'fav-item';
            const rReg = item.region || "알 수 없음";
            div.innerHTML = `<b>${t(item.name)}</b> <span style="font-size:0.8rem; color:#aaa;">(${rReg})</span><br><small>${t(item.category)}</small>`;
            div.addEventListener('click', () => {
                jumpToId(item.id);
                if (window.innerWidth <= 768) toggleSidebar('close');
            });
            favListEl.appendChild(div);
        }
    });
}

function renderLinks() {
    const linkTab = document.getElementById('link-tab');
    let linkListEl = linkTab ? linkTab.querySelector('.link-list') : null;
    if (!linkListEl) return;

    linkListEl.innerHTML = '';
    usefulLinks.forEach(link => {
        const a = document.createElement('a');
        a.href = link.url;
        a.target = "_blank";
        a.className = "link-item";
        a.innerHTML = `🔗 ${link.title}`;
        linkListEl.appendChild(a);
    });
}

function renderUpdates() {
    const updateListEl = document.getElementById('update-list');
    if (!updateListEl) return;
    updateListEl.innerHTML = '';
    updateHistory.forEach((update, index) => {
        const isLatest = index === 0 ? 'latest' : '';
        const div = document.createElement('div');
        div.className = `update-item ${isLatest}`;
        const contentHtml = update.content.map(line => `<li>${line}</li>`).join('');
        div.innerHTML = `
            <div class="update-header">
                <span class="update-version">${update.version}</span>
                <span class="update-date">${update.date}</span>
            </div>
            <div class="update-content"><ul>${contentHtml}</ul></div>
        `;
        updateListEl.appendChild(div);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [transRes] = await Promise.all([
            fetch('./translation.json')
        ]);

        if (!transRes.ok) throw new Error("필수 파일을 찾을 수 없습니다.");

        const githubModal = document.getElementById('github-modal');
        const openGithubModalBtn = document.getElementById('open-github-modal');
        const githubModalTitle = document.getElementById('github-modal-title');
        const githubModalDesc = document.getElementById('github-modal-desc');
        const githubModalLinks = document.getElementById('github-modal-links');

        const urlParams = new URLSearchParams(window.location.search);
        const mapParam = urlParams.get('map');
        const isEmbed = urlParams.get('embed') === 'true';

        if (mapParam && MAP_CONFIGS[mapParam]) {
            currentMapKey = mapParam;
        }
        if (isEmbed) {
            document.body.classList.add('embed-mode');
            const sidebar = document.getElementById('sidebar');
            const openBtn = document.getElementById('open-sidebar');

            sidebar.classList.remove('open');
            sidebar.classList.add('collapsed');
            if (openBtn) openBtn.classList.remove('hidden-btn');
        }

        const originalBtn = document.getElementById('btn-open-original');
        if (originalBtn) {
            originalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetUrl = new URL(window.location.href);
                targetUrl.searchParams.delete('embed');
                targetUrl.searchParams.set('map', currentMapKey);

                window.open(targetUrl.toString(), '_blank');
            });
        }

        function renderContributionModal() {
            if (!githubModalTitle || !githubModalDesc || !githubModalLinks) return;
            githubModalTitle.textContent = t("contribute_title");
            githubModalDesc.innerHTML = t("contribute_description").replace(/\n/g, '<br>');
            githubModalLinks.innerHTML = contributionLinks.map(link => `
                <li style="margin-bottom: 10px;">
                    <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="link-item">
                        ${t(link.titleKey)}
                        <span class="link-url" style="float:right; opacity:0.6;">${link.icon === 'code' ? 'Code' : 'Issues'}</span>
                    </a>
                </li>
            `).join('');

            const guideContainerId = 'contribution-guide-container';
            let guideContainer = document.getElementById(guideContainerId);

            if (!guideContainer) {
                guideContainer = document.createElement('div');
                guideContainer.id = guideContainerId;
                guideContainer.style.marginTop = '25px';
                guideContainer.style.paddingTop = '20px';
                guideContainer.style.borderTop = '1px solid var(--border)';
                githubModalDesc.parentNode.appendChild(guideContainer);
            }
            guideContainer.innerHTML = `
                <div>
                    <h4 style="color: var(--accent); margin-bottom: 10px; font-size: 1rem;">
                        ${t("guide_trans_title")}
                    </h4>
                    <div style="font-size: 0.9rem; color: #ccc; line-height: 1.6; white-space: pre-wrap; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px;">${t("guide_trans_steps")}</div>
                </div>
            `;
        }

        if (openGithubModalBtn && githubModal) {
            openGithubModalBtn.addEventListener('click', () => {
                renderContributionModal();
                githubModal.classList.remove('hidden');
            });
        }

        const settingsModal = document.getElementById('settings-modal');
        const openSettingsBtn = document.getElementById('open-settings');
        const saveApiKeyBtn = document.getElementById('save-api-key');
        const apiKeyInput = document.getElementById('api-key-input');

        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                apiKeyInput.value = savedApiKey;
                settingsModal.classList.remove('hidden');
            });
        }

        if (saveApiKeyBtn) {
            saveApiKeyBtn.addEventListener('click', () => {
                savedApiKey = apiKeyInput.value.trim();
                localStorage.setItem('wwm_api_key', savedApiKey);
                alert("API Key가 저장되었습니다.");
                settingsModal.classList.add('hidden');
            });
        }

        const transJson = await transRes.json();

        if (transJson.common) {
            transJson.common.forEach(item => {
                if (!Array.isArray(item.keys) || item.keys.length === 0) return;
                item.keys.forEach(key => {
                    if (typeof key === 'string' && key.trim() !== '') {
                        koDict[key] = item.value;
                        koDict[key.trim()] = item.value;
                    }
                });
            });
        }

        if (transJson.overrides) {
            for (const categoryId in transJson.overrides) {
                const categoryData = transJson.overrides[categoryId];
                if (typeof categoryData !== 'object' || categoryData === null) continue;

                if (!categoryItemTranslations[categoryId]) categoryItemTranslations[categoryId] = {};

                if (categoryData._common_description) {
                    categoryItemTranslations[categoryId]._common_description = categoryData._common_description;
                }
                let itemArray = Array.isArray(categoryData.items) ? categoryData.items : [];
                itemArray.forEach(entry => {
                    if (Array.isArray(entry.keys) && entry.value) {
                        entry.keys.forEach(k => {
                            const keyStr = String(k).trim();
                            categoryItemTranslations[categoryId][keyStr] = entry.value;
                        });
                    }
                });
            }
        }

        initCustomDropdown();

        await loadMapData(currentMapKey);

        const savedCats = JSON.parse(localStorage.getItem('wwm_active_cats'));
        const savedRegs = JSON.parse(localStorage.getItem('wwm_active_regs'));
        const DEFAULT_CAT_ID = "17310010083";

        const validCategories = mapData.categories.filter(cat => {
            return cat.image && cat.image.trim() !== "";
        });

        activeCategoryIds.clear();
        activeRegionNames.clear();

        if (savedCats && Array.isArray(savedCats) && savedCats.length > 0) {
            savedCats.forEach(id => {
                if (validCategories.find(c => c.id === id)) activeCategoryIds.add(id);
            });
        } else {
            if (validCategories.find(c => c.id === DEFAULT_CAT_ID)) {
                activeCategoryIds.add(DEFAULT_CAT_ID);
            } else if (validCategories.length > 0) {
                activeCategoryIds.add(validCategories[0].id);
            }
        }

        if (savedRegs && Array.isArray(savedRegs) && savedRegs.length > 0) {
            savedRegs.forEach(r => {
                if (uniqueRegions.has(r)) activeRegionNames.add(r);
            });
        } else {
            uniqueRegions.forEach(r => activeRegionNames.add(r));
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.trim().toLowerCase();
                if (term === '') {
                    allMarkers.forEach(m => m.marker.setOpacity(1));
                    return;
                }
                allMarkers.forEach(m => {
                    const regionName = t(m.region).toLowerCase();
                    const categoryName = t(m.category).toLowerCase();
                    const isMatch = m.name.includes(term) || m.desc.includes(term) || regionName.includes(term) || categoryName.includes(term);
                    m.marker.setOpacity(isMatch ? 1 : 0.1);
                });
            });
        }

        const tabs = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetId = tab.getAttribute('data-tab');
                tabContents.forEach(c => {
                    c.classList.remove('active');
                    if (c.id === targetId) c.classList.add('active');
                });
            });
        });

        const btnToggleCat = document.getElementById('btn-toggle-cat');
        const btnToggleReg = document.getElementById('btn-toggle-reg');
        if (btnToggleCat) {
            btnToggleCat.addEventListener('click', () => {
                const validCats = mapData.categories.filter(cat => cat.image && cat.image.trim() !== "");
                const allActive = activeCategoryIds.size === validCats.length;
                setAllCategories(!allActive);
            });
        }
        if (btnToggleReg) {
            btnToggleReg.addEventListener('click', () => {
                const allActive = activeRegionNames.size === uniqueRegions.size;
                setAllRegions(!allActive);
            });
        }

        const openBtn = document.getElementById('open-sidebar');
        const closeBtn = document.getElementById('toggle-sidebar');
        if (openBtn) openBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSidebar('open'); });
        if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar('close'));
        window.addEventListener('resize', () => { if (map) map.invalidateSize(); });

        const modalSearchInput = document.getElementById('modal-search-input');
        if (modalSearchInput) {
            modalSearchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = currentModalList.filter(m => m.name.includes(term));
                renderModalList(filtered);
            });
        }
        const relatedModal = document.getElementById('related-modal');
        if (relatedModal) {
            relatedModal.addEventListener('click', (e) => {
                if (e.target.id === 'related-modal') closeModal();
            });
        }

        updateMapVisibility();
        updateToggleButtonsState();
        renderFavorites();
        renderLinks();
        renderUpdates();

    } catch (error) {
        console.error("초기화 실패:", error);
        alert("맵 초기화에 실패했습니다.\n" + error.message);
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = parseInt(urlParams.get('id'));
    const sharedLat = parseFloat(urlParams.get('lat'));
    const sharedLng = parseFloat(urlParams.get('lng'));

    if (sharedId && !isNaN(sharedLat) && !isNaN(sharedLng)) {
        setTimeout(() => jumpToId(sharedId), 500);
    }

    window.enableDevMode = () => {
        console.log("%c🔧 개발자 모드가 활성화되었습니다.", "color: #daac71; font-size: 16px; font-weight: bold;");
        const devModal = document.getElementById('dev-modal');
        const categorySelect = document.getElementById('dev-category');
        let tempMarker = null;
        if (categorySelect && mapData.categories) {
            categorySelect.innerHTML = '';
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "카테고리 선택...";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            categorySelect.appendChild(defaultOption);
            mapData.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = `${t(cat.name)} (${cat.id})`;
                categorySelect.appendChild(option);
            });
        }
        map.on('click', (e) => {
            const lat = e.latlng.lat.toFixed(6);
            const lng = e.latlng.lng.toFixed(6);
            if (tempMarker) map.removeLayer(tempMarker);
            const emojiIcon = L.divIcon({
                className: '',
                html: '<div style="font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); cursor: pointer;">📍</div>',
                iconSize: [36, 36],
                iconAnchor: [18, 36]
            });
            tempMarker = L.marker([lat, lng], { icon: emojiIcon, zIndexOffset: 1000 }).addTo(map);
            document.getElementById('dev-x').value = lat;
            document.getElementById('dev-y').value = lng;
            document.getElementById('dev-output').value = '';
            if (categorySelect) categorySelect.value = "";
            devModal.classList.remove('hidden');
        });
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                if (!tempMarker) return;
                const selectedCatId = e.target.value;
                const selectedCat = mapData.categories.find(c => c.id === selectedCatId);
                if (selectedCat && selectedCat.image) {
                    const newIcon = L.icon({
                        iconUrl: selectedCat.image,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15],
                        className: 'marker-anim'
                    });
                    tempMarker.setIcon(newIcon);
                } else {
                    const emojiIcon = L.divIcon({
                        className: '',
                        html: '<div style="font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">📍</div>',
                        iconSize: [36, 36],
                        iconAnchor: [18, 36]
                    });
                    tempMarker.setIcon(emojiIcon);
                }
            });
        }
        const genBtn = document.getElementById('btn-gen-json');
        if (genBtn) {
            genBtn.onclick = () => {
                const catId = document.getElementById('dev-category').value;
                if (!catId) { alert("카테고리를 선택해주세요!"); return; }
                const name = document.getElementById('dev-name').value || "New Item";
                const desc = document.getElementById('dev-desc').value || "";
                const x = document.getElementById('dev-x').value;
                const y = document.getElementById('dev-y').value;
                const tempId = Date.now();
                const newItem = {
                    id: tempId,
                    category_id: catId,
                    title: name,
                    description: desc,
                    latitude: x,
                    longitude: y,
                    regionId: 0
                };
                const jsonString = JSON.stringify(newItem, null, 4);
                const outputArea = document.getElementById('dev-output');
                outputArea.value = jsonString + ",";
                outputArea.select();
                document.execCommand('copy');
                alert("JSON이 복사되었습니다!");
            };
        }
    };
});

window.switchImage = (btn, direction) => {
    const container = btn.parentElement;
    const images = container.querySelectorAll('.popup-image');
    const counter = container.querySelector('.img-counter');

    let currentIdx = parseInt(container.dataset.idx);
    const total = parseInt(container.dataset.total);

    images[currentIdx].classList.remove('active');
    currentIdx += direction;
    if (currentIdx >= total) currentIdx = 0;
    if (currentIdx < 0) currentIdx = total - 1;

    images[currentIdx].classList.add('active');
    container.dataset.idx = currentIdx;
    if (counter) counter.innerText = `${currentIdx + 1} / ${total}`;
};

window.openLightbox = (itemId, index) => {
    const item = mapData.items.find(i => i.id === itemId);
    if (!item || !item.images || item.images.length === 0) return;

    currentLightboxImages = item.images;
    currentLightboxIndex = index;

    updateLightboxImage();

    const modal = document.getElementById('lightbox-modal');
    modal.classList.remove('hidden');

    const navBtns = modal.querySelectorAll('.lightbox-nav');
    navBtns.forEach(btn => {
        btn.style.display = currentLightboxImages.length > 1 ? 'block' : 'none';
    });
};

function updateLightboxImage() {
    const imgElement = document.getElementById('lightbox-img');
    let src = currentLightboxImages[currentLightboxIndex];
    src = src.startsWith('http') ? src : src;
    imgElement.src = src;
}

window.switchLightbox = (direction) => {
    const total = currentLightboxImages.length;
    if (total <= 1) return;

    currentLightboxIndex += direction;

    if (currentLightboxIndex >= total) currentLightboxIndex = 0;
    if (currentLightboxIndex < 0) currentLightboxIndex = total - 1;

    updateLightboxImage();
};

window.openVideoLightbox = (src) => {
    const modal = document.getElementById('video-lightbox-modal');
    const iframe = document.getElementById('lightbox-video-frame');
    if (modal && iframe) {
        iframe.src = src;
        modal.classList.remove('hidden');
    }
};

window.closeVideoLightbox = () => {
    const modal = document.getElementById('video-lightbox-modal');
    const iframe = document.getElementById('lightbox-video-frame');
    if (modal && iframe) {
        modal.classList.add('hidden');
        iframe.src = "";
    }
};

window.viewFullImage = (src) => {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    img.src = src;
    modal.classList.remove('hidden');
};

window.closeLightbox = () => {
    document.getElementById('lightbox-modal').classList.add('hidden');
};

document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox-modal');
    if (!lightbox.classList.contains('hidden')) {
        if (e.key === "Escape") {
            window.closeLightbox();
        } else if (e.key === "ArrowLeft") {
            window.switchLightbox(-1);
        } else if (e.key === "ArrowRight") {
            window.switchLightbox(1);
        }
    }
});

async function translateItem(itemId) {
    if (!savedApiKey) {
        alert("설정(⚙️) 메뉴에서 API Key를 먼저 등록해주세요.");
        return;
    }

    const item = mapData.items.find(i => i.id === itemId);
    if (!item) return;

    const btn = document.querySelector(`.popup-container[data-id="${itemId}"] .btn-translate`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = "번역 중...";
    }

    const categoryTrans = categoryItemTranslations[item.category] || {};

    const prompt = `
    You are translating game data for "Where Winds Meet" (연운) from Chinese/English to Korean.
    
    [Context Info]
    1. The source data was migrated from an English map to a Chinese map, so some records might be in English or contain English references.
    2. Reference the provided "Translation Dictionary" (translation.json data) below.
    3. Important: When translating the Name, look for the most relevant or identical term in the dictionary. If found, use that specific Korean translation to maintain consistency.
    4. Requirement: Translate the ENTIRE Chinese content in the Name and Description fields. Do not leave any Chinese text untranslated.
    
    [Translation Dictionary - Category Specific]
    ${JSON.stringify(categoryTrans)}
    
    [Translation Dictionary - Common Terms (Partial)]
    ${JSON.stringify(koDict).substring(0, 1000)} ... (truncated for brevity, prioritize Category Specific)

    [Target Item]
    Name: ${item.name}
    Description: ${item.description}
    
    [Output Format]
    Provide the response in JSON format only: {"name": "Korean Name", "description": "Korean Description"}
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${savedApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const text = data.candidates[0].content.parts[0].text;
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const result = JSON.parse(jsonStr);

        item.name = result.name;
        item.description = result.description;
        item.isTranslated = true;

        const markerObj = allMarkers.find(m => m.id === itemId);
        if (markerObj) {
            markerObj.marker.closePopup();
            markerObj.marker.bindPopup(() => createPopupHtml(item, markerObj.marker.getLatLng().lat, markerObj.marker.getLatLng().lng, item.region));
            markerObj.marker.openPopup();
        }

    } catch (error) {
        console.error("Translation failed:", error);
        alert("번역 실패: " + error.message);
        if (btn) {
            btn.disabled = false;
            btn.textContent = "✨ AI 번역 재시도";
        }
    }
}

function isPointInPolygon(point, vs) {
    var x = point[0], y = point[1];
    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];
        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

window.jumpToId = (id) => {
    const target = allMarkers.find(m => m.id === id);
    if (target) window.moveToLocation(target.marker.getLatLng(), target.marker);
};

window.moveToLocation = (latlng, marker = null) => {
    if (!map) return;
    const currentZoom = map.getZoom();
    const targetZoom = currentZoom > 12 ? currentZoom : 12;
    map.flyTo(latlng, targetZoom, { animate: true, duration: 0.8 });
    if (marker) {
        const catId = marker.options.alt;
        if (!activeCategoryIds.has(catId)) {
            activeCategoryIds.add(catId);
            const btn = document.querySelector(`.cate-item[data-id="${catId}"]`);
            if (btn) btn.classList.add('active');
        }
        if (!map.hasLayer(marker)) map.addLayer(marker);
        setTimeout(() => marker.openPopup(), 300);
    }
}

window.expandRelated = (btn) => {
    const list = btn.previousElementSibling;
    if (list) list.querySelectorAll('.related-item.hidden').forEach(item => item.classList.remove('hidden'));
    btn.remove();
};

window.openRelatedModal = (catId) => {
    const modal = document.getElementById('related-modal');
    const title = document.getElementById('modal-title');
    const listEl = document.getElementById('modal-list');
    const input = document.getElementById('modal-search-input');
    title.innerText = `${t(catId)} 전체 목록`;
    input.value = '';
    listEl.innerHTML = '';
    currentModalList = allMarkers.filter(m => m.category === catId);
    renderModalList(currentModalList);
    modal.classList.remove('hidden');
    input.focus();
};

window.closeModal = () => document.getElementById('related-modal').classList.add('hidden');

window.renderModalList = (items) => {
    const listEl = document.getElementById('modal-list');
    listEl.innerHTML = '';
    if (items.length === 0) {
        listEl.innerHTML = '<li style="padding:15px; text-align:center; color:#666;">결과가 없습니다.</li>';
        return;
    }
    const currComp = JSON.parse(localStorage.getItem('wwm_completed')) || [];
    items.forEach(m => {
        const displayRegion = m.forceRegion || m.region;
        let displayName = t(m.originalName || m.name);
        if (displayName) displayName = displayName.replace(/{region}/g, displayRegion);
        const isDone = currComp.includes(m.id);
        const statusHtml = isDone ? '<span class="modal-item-status">완료</span>' : '';
        const li = document.createElement('li');
        li.className = 'modal-item';
        li.innerHTML = `
        <div style="display:flex; flex-direction:column;">
            <span class="modal-item-name">${displayName}</span>
            <span style="font-size:0.8rem; color:#888;">${displayRegion}</span>
        </div>
        ${statusHtml}
    `;
        li.onclick = () => { jumpToId(m.id); closeModal(); };
        listEl.appendChild(li);
    });
};

window.toggleCompleted = (id) => {
    const index = completedList.indexOf(id);
    const target = allMarkers.find(m => m.id === id);
    if (index === -1) {
        completedList.push(id);
        if (target) target.marker._icon.classList.add('completed-marker');
    } else {
        completedList.splice(index, 1);
        if (target) target.marker._icon.classList.remove('completed-marker');
    }
    localStorage.setItem('wwm_completed', JSON.stringify(completedList));
    if (target && target.marker.isPopupOpen()) {
        const item = mapData.items.find(i => i.id === id);
        target.marker.setPopupContent(createPopupHtml(item, target.marker.getLatLng().lat, target.marker.getLatLng().lng, target.region));
    }
};

window.toggleFavorite = (id) => {
    const index = favorites.indexOf(id);
    const target = allMarkers.find(m => m.id === id);
    if (index === -1) favorites.push(id);
    else favorites.splice(index, 1);
    localStorage.setItem('wwm_favorites', JSON.stringify(favorites));
    renderFavorites();
    if (target && target.marker.isPopupOpen()) {
        const item = mapData.items.find(i => i.id === id);
        target.marker.setPopupContent(createPopupHtml(item, target.marker.getLatLng().lat, target.marker.getLatLng().lng, target.region));
    }
};

window.shareLocation = (id, lat, lng) => {
    const baseUrl = window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?id=${id}&lat=${lat}&lng=${lng}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('링크가 복사되었습니다!\n' + shareUrl);
    }).catch(err => prompt("링크 복사:", shareUrl));
};