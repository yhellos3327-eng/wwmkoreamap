import { state, setState } from '../state.js';
import { t } from '../utils.js';
import { saveFilterState } from '../data.js';
import { updateMapVisibility } from '../map.js';

export const CATEGORY_GROUPS = {
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

export const toggleSidebar = (action) => {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar');

    if (!sidebar) return;

    if (action === 'open') {
        sidebar.classList.add('open');
        sidebar.classList.remove('collapsed');
        if (openBtn) openBtn.classList.add('hidden-btn');
    } else {
        sidebar.classList.remove('open');
        sidebar.classList.add('collapsed');
        if (openBtn) openBtn.classList.remove('hidden-btn');
    }

    setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 300);
};

export const updateToggleButtonsState = () => {
    const btnToggleCat = document.getElementById('btn-toggle-cat');
    const btnToggleReg = document.getElementById('btn-toggle-reg');
    const validCategories = state.mapData.categories;

    if (btnToggleCat) {
        const allCatActive = validCategories.length > 0 && validCategories.every(cat => state.activeCategoryIds.has(cat.id));
        btnToggleCat.innerHTML = allCatActive ? '👁️ 모두 끄기' : '👁️‍🗨️ 모두 켜기';
        btnToggleCat.classList.toggle('off', !allCatActive);
    }
    if (btnToggleReg) {
        const allRegActive = state.activeRegionNames.size === state.uniqueRegions.size;
        btnToggleReg.innerHTML = allRegActive ? '👁️ 모두 끄기' : '👁️‍🗨️ 모두 켜기';
        btnToggleReg.classList.toggle('off', !allRegActive);
    }
};

export const setAllCategories = (isActive) => {
    const catBtns = document.querySelectorAll('#category-list .cate-item');
    state.activeCategoryIds.clear();
    const validCategories = state.mapData.categories;

    if (isActive) {
        validCategories.forEach(c => state.activeCategoryIds.add(c.id));
        catBtns.forEach(btn => btn.classList.add('active'));
    } else {
        catBtns.forEach(btn => btn.classList.remove('active'));
    }
    updateToggleButtonsState();
    updateMapVisibility();
    saveFilterState();
};

export const setAllRegions = (isActive) => {
    const regBtns = document.querySelectorAll('#region-list .cate-item');
    state.activeRegionNames.clear();
    if (isActive) {
        state.uniqueRegions.forEach(r => state.activeRegionNames.add(r));
        regBtns.forEach(btn => btn.classList.add('active'));
    } else {
        regBtns.forEach(btn => btn.classList.remove('active'));
    }
    updateToggleButtonsState();
    updateMapVisibility();
    saveFilterState();
};

export const refreshCategoryList = () => {
    const categoryListEl = document.getElementById('category-list');
    if (!categoryListEl) return;
    categoryListEl.innerHTML = '';

    const validCategories = state.mapData.categories;

    for (const [groupKey, groupInfo] of Object.entries(CATEGORY_GROUPS)) {
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
            btn.className = state.activeCategoryIds.has(cat.id) ? 'cate-item active' : 'cate-item';
            btn.dataset.id = cat.id;

            const items = state.itemsByCategory[cat.id] || [];
            const count = items.length;

            let transCount = 0;
            items.forEach(i => {
                if (i.isTranslated || state.koDict[i.name] || state.koDict[i.name.trim()]) {
                    transCount++;
                }
            });

            const percent = count > 0 ? Math.round((transCount / count) * 100) : 0;
            let progressClass = '';
            if (percent === 100) progressClass = 'done';
            else if (percent >= 70) progressClass = 'high';
            else if (percent >= 30) progressClass = 'mid';
            else if (percent > 0) progressClass = 'low';

            btn.innerHTML = `
                <span class="cate-icon"><img src="${cat.image}" alt=""></span>
                <div class="cate-info">
                    <span class="cate-name">${t(cat.name)}</span>
                    <div class="cate-meta">
                        <span class="cate-count">${count}</span>
                        <span class="cate-trans-stat ${progressClass}">${percent}% 한글화</span>
                    </div>
                </div>
            `;

            btn.addEventListener('click', () => {
                if (state.activeCategoryIds.has(cat.id)) {
                    state.activeCategoryIds.delete(cat.id);
                    btn.classList.remove('active');
                } else {
                    state.activeCategoryIds.add(cat.id);
                    btn.classList.add('active');
                    if (state.activeRegionNames.size === 0) setAllRegions(true);
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
};

export const refreshSidebarLists = () => {
    const regionListEl = document.getElementById('region-list');
    if (!regionListEl) return;
    regionListEl.innerHTML = '';

    const sortedRegions = Array.from(state.uniqueRegions).sort((a, b) => t(a).localeCompare(t(b), 'ko'));
    const regionIconUrl = './icons/17310010083.png';
    regionListEl.className = 'cate-list';

    sortedRegions.forEach(region => {
        const btn = document.createElement('div');
        btn.className = state.activeRegionNames.has(region) ? 'cate-item active' : 'cate-item';
        btn.dataset.region = region;

        const regionMarkers = state.allMarkers.filter(m => m.region === region);
        const count = regionMarkers.length;

        let translatedCount = 0;
        regionMarkers.forEach(m => {
            const item = state.mapData.items.find(i => i.id === m.id);
            if (item && (item.isTranslated || state.koDict[item.name] || state.koDict[item.name.trim()])) {
                translatedCount++;
            }
        });

        const percentage = count > 0 ? Math.round((translatedCount / count) * 100) : 0;
        const translatedName = t(region);

        let progressClass = '';
        if (percentage === 100) progressClass = 'done';
        else if (percentage >= 70) progressClass = 'high';
        else if (percentage >= 30) progressClass = 'mid';
        else if (percentage > 0) progressClass = 'low';

        btn.innerHTML = `
            <span class="cate-icon"><img src="${regionIconUrl}" alt="Region"></span>
            <div class="cate-info">
                <span class="cate-name">${translatedName}</span>
                <div class="cate-meta">
                    <span class="cate-count">${count}</span>
                    <span class="cate-trans-stat ${progressClass}">${percentage}% 한글화</span>
                </div>
            </div>
        `;

        // Add hover effect for map region
        btn.addEventListener('mouseenter', () => {
            if (state.regionLayerGroup) {
                state.regionLayerGroup.eachLayer(layer => {
                    if (layer.regionTitle === region) {
                        layer.setStyle({
                            weight: 2,
                            fillOpacity: 0.4
                        });
                    }
                });
            }
        });

        btn.addEventListener('mouseleave', () => {
            if (state.regionLayerGroup) {
                state.regionLayerGroup.eachLayer(layer => {
                    if (layer.regionTitle === region) {
                        layer.setStyle({
                            weight: 1,
                            fillOpacity: 0.1
                        });
                    }
                });
            }
        });

        btn.addEventListener('click', (e) => {
            if (state.activeRegionNames.has(region)) {
                state.activeRegionNames.delete(region);
                btn.classList.remove('active');
            } else {
                state.activeRegionNames.add(region);
                btn.classList.add('active');
                if (state.activeCategoryIds.size === 0) setAllCategories(true);
            }
            updateToggleButtonsState();
            updateMapVisibility();
            saveFilterState();

            const meta = state.regionMetaInfo[region];
            if (meta) {
                state.map.flyTo([meta.lat, meta.lng], meta.zoom, {
                    animate: true,
                    duration: 1.0
                });
            }
        });
        regionListEl.appendChild(btn);
    });

    updateToggleButtonsState();
};

export const renderFavorites = () => {
    const favListEl = document.getElementById('favorite-list');
    if (!favListEl) return;
    favListEl.innerHTML = '';
    if (state.favorites.length === 0) {
        favListEl.innerHTML = '<p class="empty-msg">즐겨찾기한 항목이 없습니다.</p>';
        return;
    }
    state.favorites.forEach(favId => {
        const item = state.mapData.items.find(i => i.id === favId);
        if (item) {
            const div = document.createElement('div');
            div.className = 'fav-item';
            const rReg = item.region || "알 수 없음";
            div.innerHTML = `<b>${t(item.name)}</b> <span style="font-size:0.8rem; color:#aaa;">(${rReg})</span><br><small>${t(item.category)}</small>`;
            div.addEventListener('click', async () => {
                const { jumpToId } = await import('./navigation.js');
                jumpToId(item.id);
                if (window.innerWidth <= 768) toggleSidebar('close');
            });
            favListEl.appendChild(div);
        }
    });
};
