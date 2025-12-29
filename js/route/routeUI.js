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
            <h3>🛤️ 경로 모드</h3>
            <button class="route-close-btn" id="route-close-btn">×</button>
        </div>
        
        <div class="route-panel-content">
            <!-- Mode Toggle -->
            <div class="route-mode-toggle">
                <button class="route-mode-btn active" id="route-mode-auto" data-mode="auto">
                    🤖 자동 생성
                </button>
                <button class="route-mode-btn" id="route-mode-manual" data-mode="manual">
                    ✋ 직접 구성
                </button>
            </div>
            
            <!-- Auto Route Section -->
            <div class="route-config-section" id="route-auto-section">
                <div class="route-form-group">
                    <label>지역 선택</label>
                    <select id="route-region-select">
                        <option value="">로딩 중...</option>
                    </select>
                </div>
                
                <div class="route-form-group">
                    <label>카테고리</label>
                    <div id="route-category-list" class="route-category-list">
                        <!-- Categories will be populated here -->
                    </div>
                </div>
                
                <div class="route-form-group">
                    <label class="route-checkbox-label">
                        <input type="checkbox" id="route-exclude-completed" checked>
                        완료된 항목 제외
                    </label>
                </div>
                
                <div class="route-stats" id="route-stats">
                    <!-- Stats will be shown here -->
                </div>
                
                <button class="route-generate-btn" id="route-generate-btn">
                    🚀 경로 생성
                </button>
            </div>
            
            <!-- Manual Route Section -->
            <div class="route-manual-section" id="route-manual-section" style="display: none;">
                <div class="route-manual-info">
                    <p>맵에서 마커를 클릭하여 경로에 추가하세요.</p>
                </div>
                
                <div class="route-manual-list" id="route-manual-list">
                    <div class="no-manual-items">경로가 비어있습니다.</div>
                </div>
                
                <button class="route-generate-btn" id="route-apply-manual-btn" disabled>
                    ✓ 경로 적용
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
                    <button class="route-nav-btn" id="route-prev-btn">◀ 이전</button>
                    <button class="route-nav-btn route-complete-btn" id="route-complete-btn">✓ 완료</button>
                    <button class="route-nav-btn" id="route-next-btn">다음 ▶</button>
                </div>
                
                <div class="route-current-item" id="route-current-item">
                    <!-- Current item info -->
                </div>
                
                <div class="route-list-container">
                    <h4>경로 목록</h4>
                    <div class="route-list" id="route-list">
                        <!-- Route items will be listed here -->
                    </div>
                </div>
                
                <div class="route-actions">
                    <button class="route-action-btn" id="route-save-btn">💾 저장</button>
                    <button class="route-action-btn" id="route-share-btn">🔗 공유</button>
                    <button class="route-action-btn" id="route-clear-btn">🗑️ 초기화</button>
                </div>
            </div>
            
            <!-- Saved Routes Section -->
            <div class="route-saved-section">
                <h4>저장된 경로</h4>
                <div class="saved-routes-list" id="saved-routes-list">
                    <!-- Saved routes will be listed here -->
                </div>
            </div>
        </div>
    `;
};

const updateRegionSelector = () => {
    const select = document.getElementById('route-region-select');
    if (!select) return;

    const regions = getAvailableRegions();

    select.innerHTML = regions.map(r =>
        `<option value="${r}">${t(r) || r}</option>`
    ).join('');
    updateRouteStatsDisplay();
};

const updateCategorySelector = () => {
    const container = document.getElementById('route-category-list');
    if (!container || !state.mapData) return;

    const categories = state.mapData.categories || [];

    container.innerHTML = categories.map(cat => `
        <label class="route-category-item">
            <input type="checkbox" value="${cat.id}" class="route-category-checkbox" checked>
            <span>${t(cat.id) || cat.name || cat.id}</span>
        </label>
    `).join('');

    container.querySelectorAll('.route-category-checkbox').forEach(cb => {
        cb.addEventListener('change', updateRouteStatsDisplay);
    });
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
            ${isCompleted ? '<div class="current-item-status">✓ 완료됨</div>' : ''}
        `;
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
                    ${isCompleted ? '<span class="route-item-check">✓</span>' : ''}
                </div>
            `;
        }).join('');

        routeList.querySelectorAll('.route-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                goToStep(index);
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
        if (autoSection) autoSection.style.display = 'block';
        if (manualSection) manualSection.style.display = 'none';
        toggleManualRouteMode(false);
    } else {
        autoBtn?.classList.remove('active');
        manualBtn?.classList.add('active');
        if (autoSection) autoSection.style.display = 'none';
        if (manualSection) manualSection.style.display = 'block';
        toggleManualRouteMode(true);
    }
};

const attachRouteEventListeners = () => {
    document.getElementById('route-close-btn')?.addEventListener('click', exitRouteMode);
    document.getElementById('route-mode-auto')?.addEventListener('click', () => switchRouteMode('auto'));
    document.getElementById('route-mode-manual')?.addEventListener('click', () => switchRouteMode('manual'));
    document.getElementById('route-region-select')?.addEventListener('change', updateRouteStatsDisplay);
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
