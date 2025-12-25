import { state } from '../state.js';
import { updateMapVisibility, moveToLocation } from '../map.js';
import { saveFilterState } from '../data.js';
import { t } from '../utils.js';
import { setAllRegions, updateToggleButtonsState } from './sidebar.js';
import { renderFavorites } from './sidebar.js';
import { logger } from '../logger.js';

export const toggleCompleted = (id) => {
    const index = state.completedList.indexOf(id);
    const target = state.allMarkers.find(m => m.id === id);
    const isNowCompleted = index === -1;

    if (isNowCompleted) {
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

    const popupContainer = document.querySelector(`.popup-container[data-id="${id}"]`);
    if (popupContainer) {
        const completeBtn = popupContainer.querySelector('.btn-complete');
        if (completeBtn) {
            completeBtn.classList.toggle('active', isNowCompleted);
            completeBtn.textContent = isNowCompleted ? '완료됨' : '완료 체크';
        }
    }

    if (state.closeOnComplete && isNowCompleted && target && target.marker.isPopupOpen()) {
        target.marker.closePopup();
    }
    if (state.hideCompleted) updateMapVisibility();
};

export const toggleFavorite = (id) => {
    const index = state.favorites.indexOf(id);
    const target = state.allMarkers.find(m => m.id === id);
    const isNowFavorite = index === -1;

    if (isNowFavorite) state.favorites.push(id);
    else state.favorites.splice(index, 1);
    localStorage.setItem('wwm_favorites', JSON.stringify(state.favorites));
    renderFavorites();
    const popupContainer = document.querySelector(`.popup-container[data-id="${id}"]`);
    if (popupContainer) {
        const favBtn = popupContainer.querySelector('.btn-fav');
        if (favBtn) {
            favBtn.classList.toggle('active', isNowFavorite);
            favBtn.textContent = isNowFavorite ? '★' : '☆';
        }
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

export const findItem = (id) => {
    const targetId = String(id);
    let target = state.allMarkers.find(m => String(m.id) === targetId);

    if (target) {
        moveToLocation(target.marker.getLatLng(), target.marker, target.region);
        logger.success('Navigation', `[${target.name}] 마커로 이동`);
        return;
    }
    const item = state.mapData.items.find(i => String(i.id) === targetId);

    if (!item) {
        logger.warn('Navigation', `ID [${targetId}]를 찾을 수 없음`);
        return;
    }
    logger.log('Navigation', `숨겨진 항목 발견: ${t(item.name)} (ID: ${targetId}) - 필터 활성화`);
    let filtersChanged = false;
    if (!state.activeCategoryIds.has(item.category)) {
        state.activeCategoryIds.add(item.category);
        filtersChanged = true;
    }
    if (state.activeRegionNames.size !== state.uniqueRegions.size) {
        setAllRegions(true);
        filtersChanged = true;
    }
    if (filtersChanged) {
        updateMapVisibility();
        updateToggleButtonsState();
        saveFilterState();
    }
    setTimeout(() => {
        target = state.allMarkers.find(m => String(m.id) === targetId);
        if (target) {
            moveToLocation(target.marker.getLatLng(), target.marker, target.region);
            logger.success('Navigation', `[${target.name}] 위치로 이동 완료`);
        } else {
            logger.error('Navigation', '필터 활성화 후 마커 생성 실패');
        }
    }, 100);
};
