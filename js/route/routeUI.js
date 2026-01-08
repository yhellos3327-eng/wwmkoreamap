import { state } from '../state.js';
import { t } from '../utils.js';
import {
    isRouteModeActive,
    isManualRouteMode,
    getCurrentRoute,
    getManualRouteItems
} from './routeState.js';
import {
    generateRoute,
    displayRoute,
    clearRouteDisplay,
    exitRouteMode,
    getAvailableRegions,
    getRouteStats,
    saveRoute,
    getSavedRoutes,
    loadRoute,
    deleteRoute
} from './routeCore.js';

const HIDDEN_ROUTE_CATEGORIES = ["173100100592", "17310010091", "17310013036"];
import {
    goToStep,
    nextStep,
    prevStep,
    completeCurrentStep
} from './routeNavigation.js';
import {
    toggleManualRouteMode,
    removeFromManualRoute,
    applyManualRoute
} from './routeManual.js';
import { copyShareUrl } from './routeShare.js';

const openItemPopup = (itemId, lat, lng) => {
    if (!state.map) return;
    const markerInfo = state.allMarkers?.get(itemId);

    if (markerInfo && markerInfo.marker) {
        state.map.setView([lat, lng], Math.max(state.map.getZoom(), 14), { animate: true });
        setTimeout(() => {
            if (markerInfo.marker.openPopup) {
                markerInfo.marker.openPopup();
            }
        }, 300);
    } else {
        const item = state.mapData?.items?.find(i => i.id === itemId);
        if (item) {
            import('../map/popup.js').then(({ createPopupHtml }) => {
                const popupContent = createPopupHtml(item, lat, lng, item.region || '');
                const popup = L.popup({ maxWidth: 350, className: 'custom-popup' })
                    .setLatLng([lat, lng])
                    .setContent(popupContent)
                    .openOn(state.map);
            }).catch(() => {
                state.map.setView([lat, lng], Math.max(state.map.getZoom(), 14), { animate: true });
            });
        }
    }
};

let routePanel = null;

export const renderRouteUI = () => {
    hideRouteUI();
    routePanel = document.createElement('div');
    routePanel.id = 'route-panel';
    routePanel.className = 'route-panel';
    routePanel.innerHTML = getRoutePanelHTML();

    document.body.appendChild(routePanel);

    attachRouteEventListeners();

    updateRegionSelector();
    updateCategorySelector();
    updateSavedRoutesList();
};

export const hideRouteUI = () => {
    if (routePanel) {
        routePanel.remove();
        routePanel = null;
    }
};

const getRoutePanelHTML = () => {
    return `
        <div class="route-panel-header">
            <h3>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                경로 모드
            </h3>
            <button class="route-close-btn" id="route-close-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
        
        <div class="route-panel-content">
            <!-- Mode Toggle -->
            <div class="route-mode-toggle">
                <button class="route-mode-btn active" id="route-mode-auto" data-mode="auto">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                    자동 생성
                </button>
                <button class="route-mode-btn" id="route-mode-manual" data-mode="manual">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                    직접 구성
                </button>
            </div>
            
            <!-- Auto Route Section -->
            <div class="route-config-section" id="route-auto-section">
                <div class="route-form-group">
                    <label>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        지역 선택
                    </label>
                    <div class="route-region-trigger" id="route-region-trigger">
                        <span class="route-region-text" id="route-region-text">지역을 선택하세요</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                    <input type="hidden" id="route-region-select" value="">
                </div>
                
                <div class="route-form-group">
                    <div class="route-category-header">
                        <label>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            카테고리
                        </label>
                        <div class="route-category-actions">
                            <button id="route-cat-toggle" class="route-cat-action-btn all-active" title="전체 토글">
                                <svg class="icon-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                                <svg class="icon-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                <span class="btn-text">모두 해제</span>
                            </button>
                        </div>
                    </div>
                    <div id="route-category-list" class="route-category-list">
                        <!-- Categories will be populated here -->
                    </div>
                </div>
                
                <div class="route-form-group">
                    <div class="route-checkbox-label checked" id="route-exclude-completed-label">
                        <input type="checkbox" id="route-exclude-completed" checked hidden>
                        <span class="route-checkbox-icon">
                            <svg class="checkbox-unchecked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"></rect></svg>
                            <svg class="checkbox-checked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"></rect><polyline points="9 12 11 14 15 10" stroke="#000" stroke-width="2.5"></polyline></svg>
                        </span>
                        완료된 항목 제외
                    </div>
                </div>
                
                <div class="route-stats" id="route-stats">
                    <!-- Stats will be shown here -->
                </div>
                
                <button class="route-generate-btn" id="route-generate-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    경로 생성
                </button>
            </div>
            
            <!-- Manual Route Section -->
            <div class="route-manual-section" id="route-manual-section" style="display: none;">
                <div class="route-manual-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    <p>맵에서 마커를 클릭하여 경로에 추가하세요.</p>
                </div>
                
                <div class="route-manual-list" id="route-manual-list">
                    <div class="no-manual-items">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        경로가 비어있습니다.
                    </div>
                </div>
                
                <button class="route-generate-btn" id="route-apply-manual-btn" disabled>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    경로 적용
                </button>
            </div>
            
            <!-- Active Route Section (hidden initially) -->
            <div class="route-active-section" id="route-active-section" style="display: none;">
                <div class="route-progress">
                    <div class="route-progress-bar">
                        <div class="route-progress-fill" id="route-progress-fill"></div>
                    </div>
                    <span class="route-progress-text" id="route-progress-text">0 / 0</span>
                </div>
                
                <div class="route-navigation">
                    <button class="route-nav-btn" id="route-prev-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        이전
                    </button>
                    <button class="route-nav-btn route-complete-btn" id="route-complete-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        완료
                    </button>
                    <button class="route-nav-btn" id="route-next-btn">
                        다음
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
                
                <div class="route-current-item" id="route-current-item">
                    <!-- Current item info -->
                </div>
                
                <div class="route-list-container">
                    <h4>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        경로 목록
                    </h4>
                    <div class="route-list" id="route-list">
                        <!-- Route items will be listed here -->
                    </div>
                </div>
                
                <div class="route-actions">
                    <button class="route-action-btn" id="route-save-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        저장
                    </button>
                    <button class="route-action-btn" id="route-share-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                        공유
                    </button>
                    <button class="route-action-btn" id="route-clear-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        초기화
                    </button>
                </div>
            </div>
            
            <!-- Saved Routes Section -->
            <div class="route-saved-section">
                <h4>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    저장된 경로
                </h4>
                <div class="saved-routes-list" id="saved-routes-list">
                    <!-- Saved routes will be listed here -->
                </div>
            </div>
        </div>
    `;
};

let selectedRegion = '';

const updateRegionSelector = () => {
    const regions = getAvailableRegions();

    // Set first region as default if none selected
    if (!selectedRegion && regions.length > 0) {
        selectedRegion = regions[0];
        const hiddenInput = document.getElementById('route-region-select');
        const textEl = document.getElementById('route-region-text');
        if (hiddenInput) hiddenInput.value = selectedRegion;
        if (textEl) textEl.textContent = t(selectedRegion) || selectedRegion;
    }

    updateRouteStatsDisplay();
};

const openRegionModal = () => {
    const regions = getAvailableRegions();

    const modal = document.createElement('div');
    modal.className = 'route-region-modal-overlay';
    modal.id = 'route-region-modal';
    modal.innerHTML = `
        <div class="route-region-modal">
            <div class="route-region-modal-header">
                <h4>지역 선택</h4>
                <button class="route-region-modal-close" id="route-region-modal-close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="route-region-modal-list">
                ${regions.map(r => `
                    <div class="route-region-option ${selectedRegion === r ? 'selected' : ''}" data-region="${r}">
                        <span class="route-region-option-name">${t(r) || r}</span>
                        ${selectedRegion === r ? '<span class="route-region-check">✓</span>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeRegionModal();
    });

    // Close button
    document.getElementById('route-region-modal-close')?.addEventListener('click', closeRegionModal);

    // Region selection
    modal.querySelectorAll('.route-region-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const region = opt.dataset.region;
            selectedRegion = region;

            const hiddenInput = document.getElementById('route-region-select');
            const textEl = document.getElementById('route-region-text');
            if (hiddenInput) hiddenInput.value = region;
            if (textEl) textEl.textContent = t(region) || region;

            updateRouteStatsDisplay();
            closeRegionModal();
        });
    });
};

const closeRegionModal = () => {
    const modal = document.getElementById('route-region-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => modal.remove(), 200);
    }
};

const updateCategorySelector = () => {
    const container = document.getElementById('route-category-list');
    if (!container || !state.mapData) return;

    const categories = (state.mapData.categories || []).filter(c => !HIDDEN_ROUTE_CATEGORIES.includes(String(c.id)));

    container.innerHTML = categories.map(cat => `
        <div class="route-category-item checked" data-category="${cat.id}">
            <input type="checkbox" value="${cat.id}" class="route-category-checkbox" checked hidden>
            <span class="route-checkbox-icon">
                <svg class="checkbox-unchecked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"></rect></svg>
                <svg class="checkbox-checked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"></rect><polyline points="9 12 11 14 15 10" stroke="#000" stroke-width="2.5"></polyline></svg>
            </span>
            <span>${t(cat.id) || cat.name || cat.id}</span>
        </div>
    `).join('');

    container.querySelectorAll('.route-category-item').forEach(item => {
        const checkbox = item.querySelector('.route-category-checkbox');
        item.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            item.classList.toggle('checked', checkbox.checked);
            updateRouteStatsDisplay();
            updateCategoryToggleBtn();
        });
    });

    updateCategoryToggleBtn();
};

const updateCategoryToggleBtn = () => {
    const btn = document.getElementById('route-cat-toggle');
    if (!btn) return;

    const items = document.querySelectorAll('.route-category-item');
    const checkedItems = document.querySelectorAll('.route-category-item.checked');
    const allChecked = items.length > 0 && items.length === checkedItems.length;

    const iconAll = btn.querySelector('.icon-all');
    const iconNone = btn.querySelector('.icon-none');
    const text = btn.querySelector('.btn-text');

    if (allChecked) {
        btn.classList.add('all-active');
        if (iconAll) iconAll.style.display = 'block';
        if (iconNone) iconNone.style.display = 'none';
        if (text) text.textContent = '모두 해제';
    } else {
        btn.classList.remove('all-active');
        if (iconAll) iconAll.style.display = 'none';
        if (iconNone) iconNone.style.display = 'block';
        if (text) text.textContent = '모두 선택';
    }
};

const getSelectedCategories = () => {
    const checkboxes = document.querySelectorAll('.route-category-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
};

const updateRouteStatsDisplay = () => {
    const statsContainer = document.getElementById('route-stats');
    const regionSelect = document.getElementById('route-region-select');

    if (!statsContainer || !regionSelect) return;

    const region = regionSelect.value || 'all';
    const categories = getSelectedCategories();
    const stats = getRouteStats(region, categories);

    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">전체</span>
            <span class="stat-value">${stats.total}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">완료</span>
            <span class="stat-value">${stats.completed}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">남은 항목</span>
            <span class="stat-value highlight">${stats.remaining}</span>
        </div>
    `;
};

export const updateManualRouteUI = (items) => {
    const container = document.getElementById('route-manual-list');
    const applyBtn = document.getElementById('route-apply-manual-btn');

    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = '<div class="no-manual-items">경로가 비어있습니다.</div>';
        if (applyBtn) applyBtn.disabled = true;
        return;
    }

    if (applyBtn) applyBtn.disabled = false;

    container.innerHTML = items.map((item, index) => `
        <div class="manual-route-item" data-id="${item.id}" data-index="${index}">
            <span class="manual-item-order">${item.order}</span>
            <span class="manual-item-name">${t(item.name) || item.name}</span>
            <button class="manual-item-remove" data-id="${item.id}">×</button>
        </div>
    `).join('');

    container.querySelectorAll('.manual-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromManualRoute(btn.dataset.id);
        });
    });
};

export const updateRouteProgress = (route, currentIndex) => {
    if (!route) return;

    const progressFill = document.getElementById('route-progress-fill');
    const progressText = document.getElementById('route-progress-text');
    const currentItemContainer = document.getElementById('route-current-item');
    const routeList = document.getElementById('route-list');
    const activeSection = document.getElementById('route-active-section');

    if (activeSection) {
        activeSection.style.display = 'block';
    }

    const completedCount = route.route.filter(p =>
        state.completedList.some(c => c.id === p.id)
    ).length;

    const progress = (completedCount / route.route.length) * 100;

    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }

    if (progressText) {
        progressText.textContent = `${completedCount} / ${route.route.length}`;
    }

    if (currentItemContainer && route.route[currentIndex]) {
        const current = route.route[currentIndex];
        const isCompleted = state.completedList.some(c => c.id === current.id);

        currentItemContainer.innerHTML = `
            <div class="current-item-header">
                <span class="current-item-order">#${current.order}</span>
                <span class="current-item-name ${isCompleted ? 'completed' : ''}">${t(current.name) || current.name}</span>
            </div>
            <div class="current-item-region">${t(current.region) || current.region}</div>
            <div class="current-item-actions">
                ${isCompleted ? '<span class="current-item-status">✓ 완료됨</span>' : ''}
                <button class="route-detail-btn" data-id="${current.id}" data-lat="${current.lat}" data-lng="${current.lng}" title="상세 정보 보기">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    상세보기
                </button>
            </div>
        `;

        currentItemContainer.querySelector('.route-detail-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openItemPopup(current.id, current.lat, current.lng);
        });
    }

    if (routeList) {
        routeList.innerHTML = route.route.map((point, index) => {
            const isCompleted = state.completedList.some(c => c.id === point.id);
            const isCurrent = index === currentIndex;

            return `
                <div class="route-list-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}" 
                     data-index="${index}">
                    <span class="route-item-order">${point.order}</span>
                    <span class="route-item-name">${t(point.name) || point.name}</span>
                    <button class="route-item-detail-btn" data-id="${point.id}" data-lat="${point.lat}" data-lng="${point.lng}" title="상세 정보">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    </button>
                    ${isCompleted ? '<span class="route-item-check">✓</span>' : ''}
                </div>
            `;
        }).join('');

        routeList.querySelectorAll('.route-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.route-item-detail-btn')) return;
                const index = parseInt(item.dataset.index);
                goToStep(index);
            });
        });

        routeList.querySelectorAll('.route-item-detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const { id, lat, lng } = btn.dataset;
                openItemPopup(id, parseFloat(lat), parseFloat(lng));
            });
        });

        const currentItem = routeList.querySelector('.route-list-item.current');
        if (currentItem) {
            currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    updateSavedRoutesList();
};

const updateSavedRoutesList = () => {
    const container = document.getElementById('saved-routes-list');
    if (!container) return;

    const savedRoutes = getSavedRoutes();

    if (savedRoutes.length === 0) {
        container.innerHTML = '<div class="no-saved-routes">저장된 경로가 없습니다.</div>';
        return;
    }

    container.innerHTML = savedRoutes.map(route => `
        <div class="saved-route-item" data-id="${route.id}">
            <div class="saved-route-info">
                <span class="saved-route-name">${route.name}</span>
                <span class="saved-route-meta">${route.route.length}개 지점 ${route.isManual ? '(수동)' : ''}</span>
            </div>
            <div class="saved-route-actions">
                <button class="saved-route-load-btn" data-id="${route.id}">불러오기</button>
                <button class="saved-route-delete-btn" data-id="${route.id}">삭제</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.saved-route-load-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const routeId = btn.dataset.id;
            const loaded = loadRoute(routeId);
            if (loaded) {
                displayRoute();
            }
        });
    });

    container.querySelectorAll('.saved-route-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('이 경로를 삭제하시겠습니까?')) {
                deleteRoute(btn.dataset.id);
                updateSavedRoutesList();
            }
        });
    });
};

const switchRouteMode = (mode) => {
    const autoBtn = document.getElementById('route-mode-auto');
    const manualBtn = document.getElementById('route-mode-manual');
    const autoSection = document.getElementById('route-auto-section');
    const manualSection = document.getElementById('route-manual-section');

    if (mode === 'auto') {
        autoBtn?.classList.add('active');
        manualBtn?.classList.remove('active');
        if (autoSection) autoSection.style.display = 'flex';
        if (manualSection) manualSection.style.display = 'none';
        toggleManualRouteMode(false);
    } else {
        autoBtn?.classList.remove('active');
        manualBtn?.classList.add('active');
        if (autoSection) autoSection.style.display = 'none';
        if (manualSection) manualSection.style.display = 'flex';
        toggleManualRouteMode(true);
    }
};

const attachRouteEventListeners = () => {
    document.getElementById('route-close-btn')?.addEventListener('click', exitRouteMode);
    document.getElementById('route-mode-auto')?.addEventListener('click', () => switchRouteMode('auto'));
    document.getElementById('route-mode-manual')?.addEventListener('click', () => switchRouteMode('manual'));
    document.getElementById('route-region-trigger')?.addEventListener('click', openRegionModal);

    // Category Toggle
    document.getElementById('route-cat-toggle')?.addEventListener('click', () => {
        const items = document.querySelectorAll('.route-category-item');
        const checkedItems = document.querySelectorAll('.route-category-item.checked');
        const allChecked = items.length > 0 && items.length === checkedItems.length;

        items.forEach(item => {
            const checkbox = item.querySelector('.route-category-checkbox');
            if (checkbox) {
                checkbox.checked = !allChecked;
                item.classList.toggle('checked', !allChecked);
            }
        });
        updateRouteStatsDisplay();
        updateCategoryToggleBtn();
    });

    // Exclude completed checkbox toggle
    const excludeLabel = document.getElementById('route-exclude-completed-label');
    const excludeCheckbox = document.getElementById('route-exclude-completed');
    excludeLabel?.addEventListener('click', () => {
        if (excludeCheckbox) {
            excludeCheckbox.checked = !excludeCheckbox.checked;
            excludeLabel.classList.toggle('checked', excludeCheckbox.checked);
            updateRouteStatsDisplay();
        }
    });

    document.getElementById('route-generate-btn')?.addEventListener('click', () => {
        const region = document.getElementById('route-region-select')?.value;
        if (!region) {
            alert('지역을 선택해주세요.');
            return;
        }
        const categories = getSelectedCategories();
        const excludeCompleted = document.getElementById('route-exclude-completed')?.checked ?? true;

        const route = generateRoute(region, categories, excludeCompleted);
        if (route) {
            displayRoute();
        } else {
            alert('경로를 생성할 수 없습니다. 해당 지역에 선택한 카테고리의 아이템이 없습니다.');
        }
    });

    document.getElementById('route-apply-manual-btn')?.addEventListener('click', () => {
        const route = applyManualRoute();
        if (route) {
            displayRoute();
            switchRouteMode('auto');
        }
    });

    document.getElementById('route-prev-btn')?.addEventListener('click', prevStep);
    document.getElementById('route-next-btn')?.addEventListener('click', nextStep);
    document.getElementById('route-complete-btn')?.addEventListener('click', completeCurrentStep);
    document.getElementById('route-save-btn')?.addEventListener('click', () => {
        const name = prompt('경로 이름을 입력하세요:', `경로 ${new Date().toLocaleDateString()}`);
        if (name) {
            saveRoute(name);
            updateSavedRoutesList();
        }
    });

    document.getElementById('route-share-btn')?.addEventListener('click', async () => {
        const success = await copyShareUrl();
        if (success) {
            alert('공유 URL이 클립보드에 복사되었습니다.');
        }
    });

    document.getElementById('route-clear-btn')?.addEventListener('click', () => {
        if (confirm('현재 경로를 초기화하시겠습니까?')) {
            clearRouteDisplay();
            document.getElementById('route-active-section').style.display = 'none';
        }
    });
};

export const createRouteToggleButton = () => {
    const button = document.createElement('button');
    button.id = 'route-mode-toggle';
    button.className = 'route-toggle-btn';
    button.innerHTML = '🛤️ 경로';
    button.title = '경로 모드';

    return button;
};
