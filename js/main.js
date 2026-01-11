import { state, setState, subscribe, dispatch } from './state.js';
import { loadMapData } from './data.js';
import { renderMapDataAndMarkers, moveToLocation } from './map.js';
import {
    toggleSidebar, renderFavorites, initCustomDropdown,
    openRelatedModal, closeModal, renderModalList, openLightbox, switchLightbox, closeLightbox,
    openVideoLightbox, closeVideoLightbox, viewFullImage, switchImage,
    toggleCompleted, toggleFavorite, shareLocation, expandRelated, jumpToId, findItem
} from './ui.js';
import { translateItem } from './translation.js';
import { initMainNotice } from './main-notice.js';
import { initAuth } from './auth.js';
import { initSearch, initModalSearch } from './search.js';
import { initAllEventHandlers } from './events.js';
import { initPopupEventDelegation } from './map/popup.js';
import { initMigration, isOldDomain } from './migration.js';
import { initAds } from './ads.js';

import { memoryManager } from './memory.js';
import { initTheme } from './theme.js';

window.state = state;
window.setState = setState;
window.dispatch = dispatch;
window.subscribe = subscribe;
window.findItem = findItem;
window.finditem = findItem;
window.jumpToId = jumpToId;
window.memoryManager = memoryManager;

subscribe('isDevMode', (isDev) => {
    memoryManager.setDebug(isDev);
    if (isDev) {
        console.log('%c[MemoryManager] Debug mode enabled. Watch console for GC events.', 'color: #ff00ff');
    }
});


const handleUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);

    const mapParam = urlParams.get('map');
    if (mapParam && (mapParam === 'qinghe' || mapParam === 'kaifeng')) {
        setState('currentMapKey', mapParam);
    }

    if (urlParams.get('embed') === 'true') {
        document.body.classList.add('embed-mode');
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }

    if (urlParams.get('overlay') === 'true') {
        document.body.classList.add('overlay-mode');
    }

    return urlParams;
};

const setupLoadingSubscription = () => {
    subscribe('loadingState', (loadingState) => {
        const loadingScreen = document.getElementById('loading-screen');
        const loadingBar = document.getElementById('loading-bar');
        const loadingText = document.getElementById('loading-text');
        const loadingDetail = document.getElementById('loading-detail');

        if (!loadingState.isVisible) {
            if (loadingScreen) loadingScreen.classList.add('hidden');
            initMainNotice();
            return;
        }

        const WEIGHTS = { csv: 0.3, map: 0.7 };
        const total = (loadingState.csvProgress * WEIGHTS.csv) + (loadingState.mapProgress * WEIGHTS.map);

        if (loadingBar) loadingBar.style.width = `${Math.min(100, Math.round(total))}%`;
        if (loadingText) loadingText.textContent = loadingState.message;
        if (loadingDetail) loadingDetail.textContent = loadingState.detail;
    });
};

const handleSharedLink = (urlParams) => {
    const sharedId = parseInt(urlParams.get('id'));
    const sharedLat = parseFloat(urlParams.get('lat'));
    const sharedLng = parseFloat(urlParams.get('lng'));
    const routeParam = urlParams.get('route');

    if (routeParam) {
        import('./route/index.js').then(routeModule => {
            routeModule.loadRouteFromUrl();
        }).catch(err => {
            console.error('Failed to load shared route:', err);
        });
        return;
    }

    if (sharedId) {
        setTimeout(() => findItem(sharedId), 1000);
    } else if (!isNaN(sharedLat) && !isNaN(sharedLng)) {
        setTimeout(() => {
            if (state.map) {
                state.map.flyTo([sharedLat, sharedLng], 17, { animate: true });
            }
        }, 1000);
    }
};

import { loadAllComponents } from './component-loader.js';

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initMigration();

    if (isOldDomain()) {
        return;
    }

    console.log('[Main] Initial localStorage check:', {
        completed: localStorage.getItem('wwm_completed'),
        favorites: localStorage.getItem('wwm_favorites')
    });

    const urlParams = handleUrlParams();

    try {
        await loadAllComponents();

        if (!document.body.classList.contains('embed-mode')) {
            document.body.classList.add('sidebar-open');
        }

        setupLoadingSubscription();

        window.addEventListener('syncDataLoaded', (e) => {
            const cloudData = e.detail;
            if (!cloudData) return;

            console.log('[Main] Sync data loaded, updating state...', cloudData);

            if (cloudData.completedMarkers) {
                let markers = cloudData.completedMarkers;
                if (markers.length > 0 && typeof markers[0] !== 'object') {
                    markers = markers.map(id => ({ id, completedAt: null }));
                }
                setState('completedList', markers);
                console.log('[Main] State updated. LocalStorage check:', localStorage.getItem('wwm_completed'));
            }

            if (cloudData.favorites) {
                setState('favorites', cloudData.favorites);
            }

            if (cloudData.settings) {
                const s = cloudData.settings;
                if (s.showComments !== undefined) setState('showComments', s.showComments === 'true' || s.showComments === true);
                if (s.closeOnComplete !== undefined) setState('closeOnComplete', s.closeOnComplete === 'true' || s.closeOnComplete === true);
                if (s.hideCompleted !== undefined) setState('hideCompleted', s.hideCompleted === 'true' || s.hideCompleted === true);
                if (s.enableClustering !== undefined) setState('enableClustering', s.enableClustering === 'true' || s.enableClustering === true);
                if (s.regionColor !== undefined) setState('savedRegionColor', s.regionColor);
                if (s.regionFillColor !== undefined) setState('savedRegionFillColor', s.regionFillColor);
                if (s.gpuMode !== undefined) setState('gpuRenderMode', s.gpuMode === 'true' || s.gpuMode === true);
            }

            renderMapDataAndMarkers();
            renderFavorites();

            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal && !settingsModal.classList.contains('hidden')) {
                import('./settings.js').then(m => m.initSettingsModal());
            }
        });

        initAuth();
        fetch('./translation.csv')
            .then(res => res.text())
            .then(text => setState('rawCSV', text));

        initCustomDropdown();

        setState('loadingState', {
            ...state.loadingState,
            csvProgress: 100,
            message: "지도 데이터 불러오는 중..."
        });

        await loadMapData(state.currentMapKey, (loaded, total) => {
            if (total > 0) {
                const percent = Math.min(100, (loaded / total) * 100);
                setState('loadingState', {
                    ...state.loadingState,
                    mapProgress: percent,
                    detail: `지도 데이터: ${Math.round(percent)}%`
                });
            }
        });

        setState('loadingState', {
            ...state.loadingState,
            mapProgress: 100,
            message: "준비 완료!"
        });

        setTimeout(() => {
            setState('loadingState', { ...state.loadingState, isVisible: false });
        }, 500);

        initSearch();
        initModalSearch(renderModalList);
        initAllEventHandlers();
        initPopupEventDelegation();

        // Dynamic imports for non-critical modules
        import('./settings.js').then(({ initSettingsModal, initAdToggle }) => {
            initSettingsModal();
            initAdToggle();
        });

        import('./backup.js').then(({ initBackupButtons }) => {
            initBackupButtons();
        });

        import('./comments.js'); // Side-effect import

        if (state.isDevMode || localStorage.getItem('wwm_dev_mode') === 'true') {
            import('./dev-tools.js');
        }

        initAds();
        renderFavorites();

    } catch (error) {
        console.error("초기화 실패:", error);
        alert("맵 초기화에 실패했습니다.\n" + error.message);
        return;
    }

    handleSharedLink(urlParams);
});
