const updateHistory = [
    {
        version: "v1.0.6",
        date: "2025-12-06",
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

const TILE_URL = 'https://ue.17173cdn.com/a/terra/tiles/yysls/3000_v4_uN4cS8/{z}/{y}_{x}.png';

const MAP_CONFIG = {
    minZoom: 9,
    maxZoom: 13,
    tileSize: 256,
    zoomOffset: 0,
    center: [0, 0],
    zoom: 10
};

let map;
let allMarkers = [];
let markersData = [];
let categoriesData = [];
let regionData = [];
let koDict = {};
let mapData = { categories: [], items: [] };

let activeCategoryIds = new Set();
let activeRegionNames = new Set();
let uniqueRegions = new Set();
let itemsByCategory = {};
let layerGroups = {};
let completedList = JSON.parse(localStorage.getItem('wwm_completed')) || [];
let favorites = JSON.parse(localStorage.getItem('wwm_favorites')) || [];
let boundaryStones = [];
let categoryItemTranslations = {};
let currentModalList = [];

const t = (key) => {
    if (!key) return "";
    const trimmedKey = key.toString().trim();
    return koDict[trimmedKey] || key;
}

/**
 * 한국어 조사 처리 도우미 함수. (으)로/로 조사 처리를 위해 사용됨.
 * @param {string} word - 조사 적용 대상 단어
 * @param {string} type - 사용할 조사 ("으로/로", "을/를" 등)
 * @returns {string} 받침 유무에 따라 적절한 조사를 반환
 */
const getJosa = (word, type) => {
    if (!word || typeof word !== 'string') return type.split('/')[0];
    const lastChar = word.charCodeAt(word.length - 1);
    if (lastChar < 0xAC00 || lastChar > 0xD7A3) return type.split('/')[0];
    const hasJongsung = (lastChar - 0xAC00) % 28 !== 0;
    const [josa1, josa2] = type.split('/');
    return hasJongsung ? josa1 : josa2;
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [transRes, dataRes, regionsRes] = await Promise.all([
            fetch('./translation.json'),
            fetch('./data.json'),
            fetch('./regions.json')
        ]);

        if (!transRes.ok || !dataRes.ok || !regionsRes.ok) throw new Error("파일을 찾을 수 없습니다.");

        const githubModal = document.getElementById('github-modal');
        const openGithubModalBtn = document.getElementById('open-github-modal');
        const githubModalTitle = document.getElementById('github-modal-title');
        const githubModalDesc = document.getElementById('github-modal-desc');
        const githubModalLinks = document.getElementById('github-modal-links');

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

        const transJson = await transRes.json();
        const dataJson = await dataRes.json();
        const regionsJson = await regionsRes.json();

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
            const flattenedOverrides = {};
            for (const categoryId in transJson.overrides) {
                const categoryData = transJson.overrides[categoryId];
                if (typeof categoryData !== 'object' || categoryData === null) continue;
                flattenedOverrides[categoryId] = {};
                if (categoryData._common_description) {
                    flattenedOverrides[categoryId]._common_description = categoryData._common_description;
                }
                let itemArray = Array.isArray(categoryData.items) ? categoryData.items : [];
                itemArray.forEach(entry => {
                    if (Array.isArray(entry.keys) && entry.value) {
                        entry.keys.forEach(k => {
                            const keyStr = String(k).trim();
                            flattenedOverrides[categoryId][keyStr] = entry.value;
                        });
                    }
                    else {
                        for (const key in entry) {
                            const value = entry[key];
                            if (key && value && key !== 'keys' && key !== 'value') {
                                flattenedOverrides[categoryId][key] = value;
                            }
                        }
                    }
                });
            }
            categoryItemTranslations = flattenedOverrides;
        }

        const regionIdMap = {};
        if (regionsJson.data && Array.isArray(regionsJson.data)) {
            regionsJson.data.forEach(region => {
                regionIdMap[region.id] = region.title;
            });
        }

        const rawItems = dataJson.data || [];
        const uniqueCategoryIds = new Set();

        mapData.items = rawItems.map(item => {
            const catId = String(item.category_id);
            uniqueCategoryIds.add(catId);

            const regionName = regionIdMap[item.regionId] || "알 수 없음";
            return {
                ...item,
                id: item.id,
                category: catId,
                name: item.title || "Unknown",
                description: item.description || "",
                x: item.latitude,
                y: item.longitude,
                region: regionName,
                image: item.image,
                imageSizeW: 44,
                imageSizeH: 44
            };
        });

        mapData.categories = Array.from(uniqueCategoryIds).map(catId => {
            return {
                id: catId,
                name: catId,
                image: `./icons/${catId}.png`
            };
        });

    } catch (error) {
        console.error("데이터 로드 실패:", error);
        alert("맵 데이터를 불러오는데 실패했습니다. (JSON 로드 오류)\n" + error.message);
        return;
    }

    const validCategories = mapData.categories.filter(cat => {
        return cat.image && cat.image.trim() !== "";
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
                if (transData.name) item.name = transData.name;
                if (transData.description) {
                    item.description = transData.description;
                } else if (commonDesc) {
                    item.description = commonDesc;
                }
                if (transData.region) item.forceRegion = transData.region;
            }
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

    boundaryStones = mapData.items;

    function getNearestRegionName(targetX, targetY) {
        return "알 수 없음";
    }

    activeCategoryIds.clear();

    validCategories.forEach(cat => {
        activeCategoryIds.add(cat.id);
    });

    const map = L.map('map', {
        center: [0, 0],
        zoom: 11,
        minZoom: 9,
        maxZoom: 13,
        zoomControl: false,
        attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://ue.17173cdn.com/a/terra/tiles/yysls/3000_v4_uN4cS8/{z}/{y}_{x}.png', {
        tms: false,
        noWrap: true,
        tileSize: 256,
        minZoom: 9,
        maxZoom: 13
    }).addTo(map);

    mapData.items.forEach(item => {
        const lat = parseFloat(item.x);
        const lng = parseFloat(item.y);

        const regionName = item.region || "알 수 없음";

        if (regionName) uniqueRegions.add(regionName);

        const categoryObj = mapData.categories.find(c => c.id === item.category);
        const iconUrl = categoryObj ? categoryObj.image : './icons/marker.png';

        const w = item.imageSizeW || 30;
        const h = item.imageSizeH || 30;
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
            alt: item.category,
            itemId: item.id
        });

        marker.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            if (marker.isPopupOpen()) marker.closePopup();

            window.toggleCompleted(item.id);
        });

        marker.bindPopup(() => createPopupHtml(item, lat, lng, regionName));
        marker.on('click', () => {
            console.log(`클릭한 아이템: ${item.name} (ID: ${item.id})`);
            console.log(item);
        });
        allMarkers.push({
            id: item.id,
            marker: marker,
            name: item.name.toLowerCase(),
            originalName: item.name,
            desc: (item.description || '').toLowerCase(),
            category: item.category,
            region: regionName,
            forceRegion: item.forceRegion
        });
    });

    uniqueRegions.forEach(r => activeRegionNames.add(r));

    const categoryListEl = document.getElementById('category-list');

    validCategories.forEach(cat => {
        layerGroups[cat.id] = L.layerGroup();

        const btn = document.createElement('button');
        btn.className = activeCategoryIds.has(cat.id) ? 'cat-btn active' : 'cat-btn';
        btn.dataset.id = cat.id;
        btn.innerHTML = `<img src="${cat.image}" alt=""> ${t(cat.name)}`;

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
        });
        categoryListEl.appendChild(btn);
    });

    const regionListEl = document.getElementById('region-list');
    const sortedRegions = Array.from(uniqueRegions).sort();

    const defaultIconUrl = './icons/marker.png';
    const iconHtml = `<img src="${defaultIconUrl}" alt="Region" style="width: 20px; height: 20px; margin-right: 8px;">`;

    sortedRegions.forEach(region => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn active';
        btn.dataset.region = region;
        btn.innerHTML = `${iconHtml} ${t(region)}`;

        btn.addEventListener('click', () => {
            if (activeRegionNames.has(region)) {
                activeRegionNames.delete(region);
                btn.classList.remove('active');
            } else {
                activeRegionNames.add(region);
                btn.classList.add('active');
                if (activeCategoryIds.size === 0) setAllCategories(true);
            }
            updateMapVisibility();
            updateToggleButtonsState();
        });
        regionListEl.appendChild(btn);
    });

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

    map.on('moveend', updateMapVisibility);
    map.on('zoomend', updateMapVisibility);

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
            itemDescription = itemDescription.replace(/{name}/g, replaceName);
            itemDescription = itemDescription.replace(/{region}/g, displayRegion);
        } else {
            itemDescription = '<p class="no-desc">설명 없음</p>';
        }

        let imageHtml = '';
        if (item.image && item.image.startsWith('http')) {
            imageHtml = `<img src="${item.image}" alt="${translatedName}" style="max-width:100%; border-radius:4px; margin-top:8px;">`;
        }

        let relatedHtml = '';
        const relatedItems = itemsByCategory[item.category] || [];
        const filteredList = relatedItems.filter(i => i.id !== item.id);

        if (filteredList.length > 0) {
            const limit = 5;
            const hiddenCount = filteredList.length - limit;

            const listItemsHtml = filteredList.map((r, index) => {
                const hiddenClass = index >= limit ? 'hidden' : '';

                const rReg = r.forceRegion || r.region;

                let rName = t(r.name);
                if (rName) {
                    rName = rName.replace(/{region}/g, rReg);
                }

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
                ${itemDescription.startsWith('<p') ? itemDescription : `<p>${itemDescription}</p>`}
                ${imageHtml}
            </div>
            ${relatedHtml}
            <div class="popup-actions">
                <button class="action-btn btn-fav ${isFav ? 'active' : ''}" onclick="toggleFavorite(${item.id})" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
                <button class="action-btn btn-complete ${isCompleted ? 'active' : ''}" onclick="toggleCompleted(${item.id})" title="완료 상태로 표시">${isCompleted ? '완료됨' : '완료 체크'}</button>
                <button class="action-btn btn-share" onclick="shareLocation(${item.id}, ${lat}, ${lng})" title="위치 공유">📤</button>
            </div>
            <div class="popup-footer">
                <span class="badge">${categoryName}</span>
                <span class="badge" style="margin-left:5px;">${displayRegion}</span>
            </div>
        </div>
    `;
    }

    function setAllCategories(isActive) {
        const catBtns = document.querySelectorAll('#category-list .cat-btn');
        activeCategoryIds.clear();
        if (isActive) {
            validCategories.forEach(c => activeCategoryIds.add(c.id));
            catBtns.forEach(btn => btn.classList.add('active'));
        } else {
            catBtns.forEach(btn => btn.classList.remove('active'));
        }
        updateToggleButtonsState();
        updateMapVisibility();
    }

    function setAllRegions(isActive) {
        const regBtns = document.querySelectorAll('#region-list .cat-btn');
        activeRegionNames.clear();
        if (isActive) {
            uniqueRegions.forEach(r => activeRegionNames.add(r));
            regBtns.forEach(btn => btn.classList.add('active'));
        } else {
            regBtns.forEach(btn => btn.classList.remove('active'));
        }
        updateToggleButtonsState();
        updateMapVisibility();
    }

    function updateToggleButtonsState() {
        const btnToggleCat = document.getElementById('btn-toggle-cat');
        const btnToggleReg = document.getElementById('btn-toggle-reg');

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

    const btnToggleCat = document.getElementById('btn-toggle-cat');
    const btnToggleReg = document.getElementById('btn-toggle-reg');
    if (btnToggleCat) {
        btnToggleCat.addEventListener('click', () => {
            const allActive = activeCategoryIds.size === validCategories.length;
            setAllCategories(!allActive);
        });
    }
    if (btnToggleReg) {
        btnToggleReg.addEventListener('click', () => {
            const allActive = activeRegionNames.size === uniqueRegions.size;
            setAllRegions(!allActive);
        });
    }

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

        if (target) {
            const item = mapData.items.find(i => i.id === id);
            const lat = target.marker.getLatLng().lat;
            const lng = target.marker.getLatLng().lng;

            if (target.marker.isPopupOpen()) {
                target.marker.setPopupContent(createPopupHtml(item, lat, lng, target.region));
            }
        }
    };

    window.toggleFavorite = (id) => {
        const index = favorites.indexOf(id);
        const target = allMarkers.find(m => m.id === id);
        if (index === -1) favorites.push(id);
        else favorites.splice(index, 1);
        localStorage.setItem('wwm_favorites', JSON.stringify(favorites));
        renderFavorites();

        if (target) {
            const item = mapData.items.find(i => i.id === id);
            const lat = target.marker.getLatLng().lat;
            const lng = target.marker.getLatLng().lng;
            target.marker.setPopupContent(createPopupHtml(item, lat, lng, target.region));
        }
    };

    window.shareLocation = (id, lat, lng) => {
        const baseUrl = window.location.href.split('?')[0];
        const shareUrl = `${baseUrl}?id=${id}&lat=${lat}&lng=${lng}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('링크가 복사되었습니다!\n' + shareUrl);
        }).catch(err => prompt("링크 복사:", shareUrl));
    };

    window.moveToLocation = (latlng, marker = null) => {
        if (!map) return;

        const currentZoom = map.getZoom();
        const targetZoom = currentZoom > 6 ? currentZoom : 6;

        map.flyTo(latlng, targetZoom, {
            animate: true,
            duration: 0.8,
            easeLinearity: 0.25
        });

        if (marker) {
            const catId = marker.options.alt;
            if (!activeCategoryIds.has(catId)) {
                activeCategoryIds.add(catId);
                const btn = document.querySelector(`.cat-btn[data-id="${catId}"]`);
                if (btn) btn.classList.add('active');
            }
            if (!map.hasLayer(marker)) {
                map.addLayer(marker);
            }

            setTimeout(() => {
                marker.openPopup();
            }, 300);
        }
    }

    window.jumpToId = (id) => {
        const target = allMarkers.find(m => m.id === id);
        if (target) {
            window.moveToLocation(target.marker.getLatLng(), target.marker);
        }
    };

    window.expandRelated = (btn) => {
        const list = btn.previousElementSibling;
        if (list) {
            list.querySelectorAll('.related-item.hidden').forEach(item => item.classList.remove('hidden'));
        }
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

    window.closeModal = () => {
        document.getElementById('related-modal').classList.add('hidden');
    };

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

            if (displayName) {
                displayName = displayName.replace(/{region}/g, displayRegion);
            }

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
            li.onclick = () => {
                jumpToId(m.id);
                closeModal();
            };
            listEl.appendChild(li);
        });
    };

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
        const linkListEl = document.getElementById('link-tab').querySelector('.link-list');
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

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        if (term === '') {
            allMarkers.forEach(m => m.marker.setOpacity(1));
            return;
        }
        allMarkers.forEach(m => {
            const isMatch = m.name.includes(term) || m.desc.includes(term);
            m.marker.setOpacity(isMatch ? 1 : 0.1);
        });
    });

    document.getElementById('modal-search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = currentModalList.filter(m => m.name.includes(term));
        renderModalList(filtered);
    });
    document.getElementById('related-modal').addEventListener('click', (e) => {
        if (e.target.id === 'related-modal') closeModal();
    });

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

    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar');
    const closeBtn = document.getElementById('toggle-sidebar');

    function toggleSidebar(action) {
        const isMobile = window.innerWidth <= 768;
        if (action === 'open') {
            if (isMobile) sidebar.classList.add('open');
            else {
                sidebar.classList.remove('collapsed');
                setTimeout(() => { map.invalidateSize(); }, 300);
            }
        } else {
            if (isMobile) sidebar.classList.remove('open');
            else {
                sidebar.classList.add('collapsed');
                setTimeout(() => { map.invalidateSize(); }, 300);
            }
        }
    }

    if (openBtn) openBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSidebar('open'); });
    if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar('close'));
    map.on('click', () => { if (window.innerWidth <= 768) toggleSidebar('close'); });
    window.addEventListener('resize', () => { map.invalidateSize(); });

    updateMapVisibility();
    updateToggleButtonsState();
    renderFavorites();
    renderLinks();
    renderUpdates();

    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = parseInt(urlParams.get('id'));
    const sharedLat = parseFloat(urlParams.get('lat'));
    const sharedLng = parseFloat(urlParams.get('lng'));

    if (sharedId && !isNaN(sharedLat) && !isNaN(sharedLng)) {
        setTimeout(() => {
            jumpToId(sharedId);
        }, 500);
    }

    window.enableDevMode = () => {
        console.log("%c🔧 개발자 모드가 활성화되었습니다.", "color: #daac71; font-size: 16px; font-weight: bold;");
        console.log("지도에서 원하는 위치를 클릭하여 데이터를 생성하세요.");

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

            tempMarker = L.marker([lat, lng], {
                icon: emojiIcon,
                zIndexOffset: 1000
            }).addTo(map);

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
                if (!catId) {
                    alert("카테고리를 선택해주세요!");
                    return;
                }

                const name = document.getElementById('dev-name').value || "New Item";
                const desc = document.getElementById('dev-desc').value || "";
                const x = document.getElementById('dev-x').value;
                const y = document.getElementById('dev-y').value;
                const tempId = Date.now();

                const selectedCat = mapData.categories.find(c => c.id === catId);

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