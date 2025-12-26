import { state } from '../state.js';
import { updateMapVisibility, moveToLocation } from '../map.js';
import { saveFilterState } from '../data.js';
import { t } from '../utils.js';
import { setAllRegions, updateToggleButtonsState } from './sidebar.js';
import { renderFavorites } from './sidebar.js';
import { logger } from '../logger.js';
import { showCompletedTooltip, hideCompletedTooltip } from '../map/markers.js';

import { updateSinglePixiMarker } from '../map/pixiOverlay/overlayCore.js';

export const toggleCompleted = (id) => {
    const index = state.completedList.findIndex(item => item.id === id);
    const target = state.allMarkers.get(id);
    const isNowCompleted = index === -1;
    const completedAt = Date.now();

    if (isNowCompleted) {
        state.completedList.push({ id, completedAt });
        if (target && target.marker) {
            if (target.marker._icon) target.marker._icon.classList.add('completed-marker');
            if (target.marker.options.icon && target.marker.options.icon.options) {
                target.marker.options.icon.options.className += ' completed-marker';
            }
            // 마커에 mouseover 이벤트 추가
            const mouseoverHandler = (e) => {
                showCompletedTooltip(e, id, target.originalName || target.name, completedAt);
            };
            const mouseoutHandler = () => {
                hideCompletedTooltip();
            };
            target.marker._completedMouseover = mouseoverHandler;
            target.marker._completedMouseout = mouseoutHandler;
            target.marker.on('mouseover', mouseoverHandler);
            target.marker.on('mouseout', mouseoutHandler);
        }
    } else {
        state.completedList.splice(index, 1);
        if (target && target.marker) {
            if (target.marker._icon) target.marker._icon.classList.remove('completed-marker');
            if (target.marker.options.icon && target.marker.options.icon.options) {
                target.marker.options.icon.options.className = target.marker.options.icon.options.className.replace(' completed-marker', '');
            }
            // 마커에서 mouseover 이벤트 제거
            if (target.marker._completedMouseover) {
                target.marker.off('mouseover', target.marker._completedMouseover);
                target.marker.off('mouseout', target.marker._completedMouseout);
                delete target.marker._completedMouseover;
                delete target.marker._completedMouseout;
            }
            hideCompletedTooltip();
        }
    }
    localStorage.setItem('wwm_completed', JSON.stringify(state.completedList));

    // Update GPU marker if active
    if (state.gpuRenderMode) {
        updateSinglePixiMarker(id);
    }

    const popupContainer = document.querySelector(`.popup-container[data-id="${id}"]`);
    if (popupContainer) {
        const completeBtn = popupContainer.querySelector('.btn-complete');
        if (completeBtn) {
            completeBtn.classList.toggle('active', isNowCompleted);
            if (isNowCompleted) {
                const completedItem = state.completedList.find(item => item.id === id);
                const timeStr = completedItem && completedItem.completedAt
                    ? formatCompletedTime(completedItem.completedAt)
                    : '';
                completeBtn.innerHTML = `완료됨${timeStr ? `<span class="completed-time">${timeStr}</span>` : ''}`;
            } else {
                completeBtn.textContent = '완료 체크';
            }
        }
    }

    if (state.closeOnComplete && isNowCompleted) {
        if (state.gpuRenderMode) {
            if (state.map && state.map._popup && state.map._popup.itemId === id) {
                state.map.closePopup();
            }
        } else if (target && target.marker && target.marker.isPopupOpen()) {
            target.marker.closePopup();
        }
    }
    if (state.hideCompleted) updateMapVisibility();
};

// 완료 시간 포맷팅 함수
const formatCompletedTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // 오늘이면 시:분 표시
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
        // 7일 이내면 'N일 전' 표시
        return `${diffDays}일 전`;
    } else {
        // 그 이상이면 날짜 표시
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
};

// 헬퍼 함수 내보내기 (popup.js에서 사용)
export { formatCompletedTime };

export const toggleFavorite = (id) => {
    const index = state.favorites.indexOf(id);
    const target = state.allMarkers.get(id);
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
    const target = state.allMarkers.get(id) || state.allMarkers.get(String(id));
    if (target) {
        const latlng = target.marker ? target.marker.getLatLng() : [target.lat, target.lng];
        moveToLocation(latlng, target.marker || target.sprite, target.region, target.id);
    }
};

export const findItem = (id) => {
    const targetId = String(id);
    let target = state.allMarkers.get(id) || state.allMarkers.get(targetId);

    if (target) {
        const latlng = target.marker ? target.marker.getLatLng() : [target.lat, target.lng];
        moveToLocation(latlng, target.marker || target.sprite, target.region, target.id);
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
        target = state.allMarkers.get(id) || state.allMarkers.get(targetId);
        if (target) {
            const latlng = target.marker ? target.marker.getLatLng() : [target.lat, target.lng];
            moveToLocation(latlng, target.marker || target.sprite, target.region, target.id);
            logger.success('Navigation', `[${target.name}] 위치로 이동 완료`);
        } else {
            logger.error('Navigation', '필터 활성화 후 마커 생성 실패');
        }
    }, 100);
};

export const openReportPage = (itemId) => {
    const item = state.allMarkers.get(itemId);
    if (item) {
        const reportData = {
            id: item.id,
            name: item.originalName,
            category: item.category,
            region: item.region,
            description: item.desc,
            lat: item.lat,
            lng: item.lng,
            map: state.currentMapKey
        };
        localStorage.setItem('wwm_report_target', JSON.stringify(reportData));
        window.open('notice.html#report', '_blank');
    } else {
        // Fallback if item not found in markers (e.g. direct call)
        window.open(`report.html?id=${itemId}`, '_blank');
    }
};
