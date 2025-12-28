import { state, setState, subscribe } from './state.js';
import { loadMapData } from './data.js';
import { renderMapDataAndMarkers, moveToLocation } from './map.js';
import {
    toggleSidebar, renderFavorites, initCustomDropdown,
    openRelatedModal, closeModal, renderModalList, openLightbox, switchLightbox, closeLightbox,
    openVideoLightbox, closeVideoLightbox, viewFullImage, switchImage,
    toggleCompleted, toggleFavorite, shareLocation, expandRelated, jumpToId, findItem
} from './ui.js';
import { translateItem } from './translation.js';
import './dev-tools.js'; // 개발자 도구 (window.dev로 노출)
import { initMainNotice } from './main-notice.js';
import { initSettingsModal, initAdToggle } from './settings.js';
import { initBackupButtons } from './backup.js';
import { initSearch, initModalSearch } from './search.js';
import { initAllEventHandlers } from './events.js';
import { initPopupEventDelegation } from './map/popup.js';
import { initMigration, isOldDomain } from './migration.js';
import './comments.js';

window.findItem = findItem;
window.finditem = findItem;
window.jumpToId = jumpToId;


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
    initMigration();

    if (isOldDomain()) {
        return;
    }

    const urlParams = handleUrlParams();

    try {
        await loadAllComponents();
        setupLoadingSubscription();
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
        initSettingsModal();
        initBackupButtons();
        initAdToggle();
        renderFavorites();

    } catch (error) {
        console.error("초기화 실패:", error);
        alert("맵 초기화에 실패했습니다.\n" + error.message);
        return;
    }

    handleSharedLink(urlParams);
});
