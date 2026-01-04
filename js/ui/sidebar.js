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
        ids: ["17310010001", "17310010002", "17310010006", "17310010007", "17310010004", "17310010008", "17310010012", "17310010015", "17310010090", "17310010092", "17310010009", "17310010010", "17310010081", "17310010089"]
    },
    "minigames": {
        title: "미니게임",
        ids: ["17310010003", "17310010005", "17310010011", "17310010013", "17310010014", "17310010016", "17310010017", "17310010018", "17310010079", "17310010080", "17310010082", "17310010093"]
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

    const eyeOpenSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const eyeOffSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    if (btnToggleCat) {
        const allCatActive = validCategories.length > 0 && validCategories.every(cat => state.activeCategoryIds.has(cat.id));
        btnToggleCat.innerHTML = allCatActive ? `${eyeOffSvg} 모두 끄기` : `${eyeOpenSvg} 모두 켜기`;
        btnToggleCat.classList.toggle('off', !allCatActive);
    }
    if (btnToggleReg) {
        const allRegActive = state.activeRegionNames.size === state.uniqueRegions.size;
        btnToggleReg.innerHTML = allRegActive ? `${eyeOffSvg} 모두 끄기` : `${eyeOpenSvg} 모두 켜기`;
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
                    <div class="cate-name"><span>${t(cat.name)}</span></div>
                    <div class="cate-meta">
                        <span class="cate-count">${count}</span>
                        <span class="cate-trans-stat ${progressClass}">${percent}% 한글화</span>
                    </div>
                </div>
            `;

            btn.addEventListener('mouseenter', () => {
                const nameWrapper = btn.querySelector('.cate-name');
                const nameSpan = nameWrapper.querySelector('span');
                if (nameWrapper && nameSpan) {
                    const overflow = nameWrapper.scrollWidth - nameWrapper.clientWidth;
                    if (overflow > 0) {
                        nameSpan.style.setProperty('--scroll-dist', `-${overflow + 10}px`);
                        nameWrapper.classList.add('is-long');
                    } else {
                        nameWrapper.classList.remove('is-long');
                    }
                }
            });

            btn.addEventListener('mouseleave', () => {
                const nameWrapper = btn.querySelector('.cate-name');
                if (nameWrapper) {
                    nameWrapper.classList.remove('is-long');
                }
            });

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
    let regionListEl = document.getElementById('region-list');
    if (!regionListEl) {
        const regionTab = document.getElementById('region-tab');
        if (regionTab) {
            console.warn('region-list 요소가 없어 복구합니다.');
            regionListEl = document.createElement('div');
            regionListEl.id = 'region-list';
            regionListEl.className = 'category-list region-grid';
            regionTab.appendChild(regionListEl);
        } else {
            return;
        }
    }

    regionListEl.innerHTML = '';

    const sortedRegions = Array.from(state.uniqueRegions).sort((a, b) => t(a).localeCompare(t(b), 'ko'));
    const regionIconUrl = './icons/17310010083.png';
    regionListEl.classList.add('cate-list');

    sortedRegions.forEach(region => {
        const btn = document.createElement('div');
        btn.className = state.activeRegionNames.has(region) ? 'cate-item active' : 'cate-item';
        btn.dataset.region = region;

        const regionMarkers = Array.from(state.allMarkers.values()).filter(m => m.region === region);
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
                <div class="cate-name"><span>${translatedName}</span></div>
                <div class="cate-meta">
                    <span class="cate-count">${count}</span>
                    <span class="cate-trans-stat ${progressClass}">${percentage}% 한글화</span>
                </div>
            </div>
            <button class="region-reset-btn" title="${translatedName} 초기화 (완료 기록 삭제)">↻</button>
        `;

        const resetBtn = btn.querySelector('.region-reset-btn');
        resetBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`${translatedName} 지역의 완료 기록을 모두 초기화하시겠습니까?`)) {
                const { triggerSync } = await import('../sync.js');
                const { updateSinglePixiMarker } = await import('../map/pixiOverlay/overlayCore.js');

                const regionMarkerIds = new Set(regionMarkers.map(m => m.id));

                const initialLength = state.completedList.length;
                state.completedList = state.completedList.filter(item => !regionMarkerIds.has(item.id));

                if (state.completedList.length !== initialLength) {
                    localStorage.setItem('wwm_completed', JSON.stringify(state.completedList));
                    triggerSync();

                    regionMarkerIds.forEach(id => {
                        const target = state.allMarkers.get(id);
                        if (target && target.marker) {
                            if (target.marker._icon) target.marker._icon.classList.remove('completed-marker');
                            if (target.marker.options.icon && target.marker.options.icon.options) {
                                target.marker.options.icon.options.className = target.marker.options.icon.options.className.replace(' completed-marker', '');
                            }
                            if (target.marker._completedMouseover) {
                                target.marker.off('mouseover', target.marker._completedMouseover);
                                target.marker.off('mouseout', target.marker._completedMouseout);
                                delete target.marker._completedMouseover;
                                delete target.marker._completedMouseout;
                            }
                        }
                        if (state.gpuRenderMode) {
                            updateSinglePixiMarker(id);
                        }
                    });

                    updateMapVisibility();
                    alert(`${translatedName} 지역의 완료 기록이 초기화되었습니다.`);
                } else {
                    alert(`${translatedName} 지역에 완료된 항목이 없습니다.`);
                }
            }
        });

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

            const nameWrapper = btn.querySelector('.cate-name');
            const nameSpan = nameWrapper ? nameWrapper.querySelector('span') : null;
            if (nameWrapper && nameSpan) {
                const overflow = nameWrapper.scrollWidth - nameWrapper.clientWidth;
                if (overflow > 0) {
                    nameSpan.style.setProperty('--scroll-dist', `-${overflow + 10}px`);
                    nameWrapper.classList.add('is-long');
                } else {
                    nameWrapper.classList.remove('is-long');
                }
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

            const nameWrapper = btn.querySelector('.cate-name');
            if (nameWrapper) {
                nameWrapper.classList.remove('is-long');
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
    let favListEl = document.getElementById('favorite-list');

    if (!favListEl) {
        let favTab = document.getElementById('favorite-tab');
        if (!favTab) {
            const filterContainer = document.querySelector('.filter-container');
            if (filterContainer) {
                console.warn('favorite-tab 요소가 없어 복구합니다.');
                favTab = document.createElement('div');
                favTab.id = 'favorite-tab';
                favTab.className = 'tab-content';
                filterContainer.appendChild(favTab);
            } else {
                console.error('filter-container 요소도 없어 복구할 수 없습니다.');
                return;
            }
        }

        if (favTab) {
            console.warn('favorite-list 요소가 없어 복구합니다.');
            favListEl = document.createElement('div');
            favListEl.id = 'favorite-list';
            favListEl.className = 'favorite-list';
            favTab.appendChild(favListEl);
        }
    }

    favListEl.innerHTML = '';
    console.log('[Favorites] Rendering favorites:', state.favorites);

    if (state.favorites.length === 0) {
        favListEl.innerHTML = '<p class="empty-msg">즐겨찾기한 항목이 없습니다.</p>';
        return;
    }
    state.favorites.forEach(favId => {
        const item = state.mapData.items.find(i => String(i.id) === String(favId));
        if (item) {
            const div = document.createElement('div');
            div.className = 'fav-item';
            const rReg = item.region || "알 수 없음";

            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'fav-icon-wrapper';
            iconWrapper.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>`;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'fav-info';
            infoDiv.innerHTML = `
                <div class="fav-name">${t(item.name)}</div>
                <div class="fav-meta">
                    <span class="fav-region">${rReg}</span>
                    <span class="fav-category">${t(item.category)}</span>
                </div>`;

            div.appendChild(iconWrapper);
            div.appendChild(infoDiv);

            div.addEventListener('click', async () => {
                const { jumpToId } = await import('./navigation.js');
                jumpToId(item.id);
                if (window.innerWidth <= 768) toggleSidebar('close');
            });
            favListEl.appendChild(div);
        }
    });
};