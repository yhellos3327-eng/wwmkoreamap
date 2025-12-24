import { state } from '../state.js';
import { updateMapVisibility, moveToLocation, createPopupHtml } from '../map.js';
import { saveFilterState } from '../data.js';
import { t } from '../utils.js';
import { setAllRegions, updateToggleButtonsState } from './sidebar.js';
import { renderFavorites } from './sidebar.js';

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

    if (state.closeOnComplete && index === -1 && target && target.marker.isPopupOpen()) {
        target.marker.closePopup();
    } else if (target && target.marker.isPopupOpen()) {
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

export const findItem = (id) => {
    const targetId = String(id);
    let target = state.allMarkers.find(m => String(m.id) === targetId);

    if (target) {
        moveToLocation(target.marker.getLatLng(), target.marker, target.region);
        console.log(`✅ [${target.name}] 마커로 이동했습니다.`);
        return;
    }
    const item = state.mapData.items.find(i => String(i.id) === targetId);

    if (!item) {
        console.warn(`❌ ID [${targetId}]를 찾을 수 없습니다. 현재 지도 데이터에 없는 항목입니다.`);
        return;
    }
    console.log(`🔍 숨겨진 항목 발견: ${t(item.name)} (ID: ${targetId}) - 필터를 활성화합니다.`);
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
            console.log(`🚀 [${target.name}] 위치로 이동 완료!`);
        } else {
            console.error("⚠️ 오류: 필터를 활성화했으나 마커를 생성하지 못했습니다.");
        }
    }, 100);
};
