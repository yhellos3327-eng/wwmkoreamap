import { state, setState } from './state.js';
import { MAP_CONFIGS, contributionLinks } from './config.js';
import { t } from './utils.js';
import { loadMapData, saveFilterState } from './data.js';
import { updateMapVisibility, moveToLocation, createPopupHtml } from './map.js';

export const toggleSidebar = (action) => {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar');

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

export const refreshCategoryList = () => {
    const categoryListEl = document.getElementById('category-list');
    categoryListEl.innerHTML = '';

    const validCategories = state.mapData.categories;

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
            const progressClass = percent === 100 ? 'done' : (percent > 0 ? 'in-progress' : '');

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
    regionListEl.innerHTML = '';

    const sortedRegions = Array.from(state.uniqueRegions).sort((a, b) => t(a).localeCompare(t(b), 'ko'));
    const regionIconUrl = './icons/17310010083.png';
    regionListEl.className = 'cate-list';

    sortedRegions.forEach(region => {
        const btn = document.createElement('div');
        btn.className = state.activeRegionNames.has(region) ? 'cate-item active' : 'cate-item';
        btn.dataset.region = region;

        const count = state.allMarkers.filter(m => m.region === region).length;
        const translatedName = t(region);

        btn.innerHTML = `
            <span class="cate-icon"><img src="${regionIconUrl}" alt="Region"></span>
            <span class="cate-name">${translatedName}</span>
            <span class="cate-count">${count}</span>
        `;

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

export const renderFavorites = () => {
    const favListEl = document.getElementById('favorite-list');
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
            div.addEventListener('click', () => {
                jumpToId(item.id);
                if (window.innerWidth <= 768) toggleSidebar('close');
            });
            favListEl.appendChild(div);
        }
    });
};

export const handleMapSelection = async (key, config, customSelect, optionsContainer, selectedText, optionDiv) => {
    if (state.currentMapKey === key) {
        customSelect.classList.remove('open');
        return;
    }

    setState('currentMapKey', key);
    if (selectedText) selectedText.textContent = config.name;

    const allOptions = optionsContainer.querySelectorAll('.custom-option');
    allOptions.forEach(opt => opt.classList.remove('selected'));
    optionDiv.classList.add('selected');

    customSelect.classList.remove('open');

    await loadMapData(state.currentMapKey);
};

export const createDropdownOption = (key, config, customSelect, optionsContainer, selectedText) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = `custom-option ${key === state.currentMapKey ? 'selected' : ''}`;
    optionDiv.dataset.value = key;
    optionDiv.textContent = config.name;

    optionDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMapSelection(key, config, customSelect, optionsContainer, selectedText, optionDiv);
    });

    return optionDiv;
};

export const setupDropdownEvents = (customSelect, trigger) => {
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelect.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            customSelect.classList.remove('open');
        }
    });
};

export const initCustomDropdown = () => {
    const customSelect = document.getElementById('custom-map-select');
    if (!customSelect) return;

    const trigger = customSelect.querySelector('.select-trigger');
    const optionsContainer = customSelect.querySelector('.select-options');
    const selectedText = customSelect.querySelector('.selected-text');

    optionsContainer.innerHTML = '';

    Object.keys(MAP_CONFIGS).forEach(key => {
        const config = MAP_CONFIGS[key];
        const optionDiv = createDropdownOption(key, config, customSelect, optionsContainer, selectedText);
        optionsContainer.appendChild(optionDiv);
    });

    if (MAP_CONFIGS[state.currentMapKey] && selectedText) {
        selectedText.textContent = MAP_CONFIGS[state.currentMapKey].name;
    }

    setupDropdownEvents(customSelect, trigger);
};

export const renderContributionModal = () => {
    const githubModalTitle = document.getElementById('github-modal-title');
    const githubModalDesc = document.getElementById('github-modal-desc');
    const linksContainer = document.getElementById('github-modal-links');
    const guideContainer = document.getElementById('contribution-guide-container');

    if (!githubModalTitle || !githubModalDesc || !linksContainer || !guideContainer) return;

    githubModalTitle.textContent = t("contribute_title");
    githubModalDesc.innerHTML = t("contribute_description").replace(/\n/g, '<br>');

    // Links
    linksContainer.innerHTML = contributionLinks.map(link => `
        <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="github-link-card">
            <div class="github-card-icon">${link.icon === 'code' ? '💻' : '🐛'}</div>
            <div class="github-card-title">${t(link.titleKey)}</div>
            <div class="github-card-desc">${link.icon === 'code' ? 'Source Code' : 'Bug Reports'}</div>
        </a>
    `).join('');

    // Guide
    guideContainer.innerHTML = `
        <h1 style="margin-bottom: 15px; margin-left: 5px; font-size: 1.5rem;">${t("guide_trans_title")}</h1>
        <div class="guide-steps">${t("guide_trans_steps")}</div>
    `;
};

export const openRelatedModal = (catId) => {
    const modal = document.getElementById('related-modal');
    const title = document.getElementById('modal-title');
    const listEl = document.getElementById('modal-list');
    const input = document.getElementById('modal-search-input');
    title.innerText = `${t(catId)} 전체 목록`;
    input.value = '';
    listEl.innerHTML = '';
    const currentModalList = state.allMarkers.filter(m => m.category === catId);
    setState('currentModalList', currentModalList);
    renderModalList(currentModalList);
    modal.classList.remove('hidden');
    input.focus();
};

export const closeModal = () => document.getElementById('related-modal').classList.add('hidden');

export const renderModalList = (items) => {
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

        const catObj = state.mapData.categories.find(c => c.id === m.category);
        const iconUrl = catObj ? catObj.image : './icons/marker.png';

        const li = document.createElement('li');
        li.className = 'modal-list-item';
        li.innerHTML = `
        <img src="${iconUrl}" class="modal-item-icon" alt="icon">
        <div class="modal-item-info">
            <div class="modal-item-name">${displayName}</div>
            <div class="modal-item-region">${displayRegion}</div>
        </div>
        ${statusHtml}
    `;
        li.onclick = () => { jumpToId(m.id); closeModal(); };
        listEl.appendChild(li);
    });
};

export const openLightbox = (itemId, index) => {
    // Handle direct URL passed as first argument
    if (typeof itemId === 'string' && (itemId.startsWith('http') || itemId.startsWith('//') || itemId.startsWith('./'))) {
        setState('currentLightboxImages', [itemId]);
        setState('currentLightboxIndex', 0);
        updateLightboxImage();
        const modal = document.getElementById('lightbox-modal');
        modal.classList.remove('hidden');
        const navBtns = modal.querySelectorAll('.lightbox-nav');
        navBtns.forEach(btn => btn.style.display = 'none');
        return;
    }

    const item = state.mapData.items.find(i => i.id === itemId);
    if (!item || !item.images || item.images.length === 0) return;

    setState('currentLightboxImages', item.images);
    setState('currentLightboxIndex', index);

    updateLightboxImage();

    const modal = document.getElementById('lightbox-modal');
    modal.classList.remove('hidden');

    const navBtns = modal.querySelectorAll('.lightbox-nav');
    navBtns.forEach(btn => {
        btn.style.display = state.currentLightboxImages.length > 1 ? 'block' : 'none';
    });
};

function updateLightboxImage() {
    const imgElement = document.getElementById('lightbox-img');
    let src = state.currentLightboxImages[state.currentLightboxIndex];
    src = src.startsWith('http') ? src : src;
    imgElement.src = src;
}

export const switchLightbox = (direction) => {
    const total = state.currentLightboxImages.length;
    if (total <= 1) return;

    let idx = state.currentLightboxIndex + direction;

    if (idx >= total) idx = 0;
    if (idx < 0) idx = total - 1;

    setState('currentLightboxIndex', idx);
    updateLightboxImage();
};

export const closeLightbox = () => {
    document.getElementById('lightbox-modal').classList.add('hidden');
};

export const openVideoLightbox = (src) => {
    const modal = document.getElementById('video-lightbox-modal');
    const iframe = document.getElementById('lightbox-video-frame');
    if (modal && iframe) {
        iframe.src = src;
        modal.classList.remove('hidden');
    }
};

export const closeVideoLightbox = () => {
    const modal = document.getElementById('video-lightbox-modal');
    const iframe = document.getElementById('lightbox-video-frame');
    if (modal && iframe) {
        modal.classList.add('hidden');
        iframe.src = "";
    }
};

export const viewFullImage = (src) => {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    img.src = src;
    modal.classList.remove('hidden');
};

export const switchImage = (btn, direction) => {
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

export const toggleCompleted = (id) => {
    const index = state.completedList.indexOf(id);
    const target = state.allMarkers.find(m => m.id === id);

    if (index === -1) {
        state.completedList.push(id);
        if (target) {
            if (target.marker._icon) target.marker._icon.classList.add('completed-marker');
            if (target.marker.options.icon && target.marker.options.icon.options) {
                target.marker.options.icon.options.className += ' completed-marker';
            }
        }
    } else {
        state.completedList.splice(index, 1);
        if (target) {
            if (target.marker._icon) target.marker._icon.classList.remove('completed-marker');
            if (target.marker.options.icon && target.marker.options.icon.options) {
                target.marker.options.icon.options.className = target.marker.options.icon.options.className.replace(' completed-marker', '');
            }
        }
    }
    localStorage.setItem('wwm_completed', JSON.stringify(state.completedList));
    if (target && target.marker.isPopupOpen()) {
        const item = state.mapData.items.find(i => i.id === id);
        target.marker.setPopupContent(createPopupHtml(item, target.marker.getLatLng().lat, target.marker.getLatLng().lng, target.region));
    }
    if (state.hideCompleted) updateMapVisibility();
};

export const toggleFavorite = (id) => {
    const index = state.favorites.indexOf(id);
    const target = state.allMarkers.find(m => m.id === id);
    if (index === -1) state.favorites.push(id);
    else state.favorites.splice(index, 1);
    localStorage.setItem('wwm_favorites', JSON.stringify(state.favorites));
    renderFavorites();
    if (target && target.marker.isPopupOpen()) {
        const item = state.mapData.items.find(i => i.id === id);
        target.marker.setPopupContent(createPopupHtml(item, target.marker.getLatLng().lat, target.marker.getLatLng().lng, target.region));
    }
};

export const shareLocation = (id, lat, lng) => {
    const baseUrl = window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?id=${id}&lat=${lat}&lng=${lng}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('링크가 복사되었습니다!\n' + shareUrl);
    }).catch(err => prompt("링크 복사:", shareUrl));
};

export const expandRelated = (btn) => {
    const list = btn.previousElementSibling;
    if (list) list.querySelectorAll('.related-item.hidden').forEach(item => item.classList.remove('hidden'));
    btn.remove();
};

export const jumpToId = (id) => {
    const target = state.allMarkers.find(m => m.id === id);
    if (target) moveToLocation(target.marker.getLatLng(), target.marker, target.region);
};
