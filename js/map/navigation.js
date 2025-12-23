import { state } from '../state.js';
import { updateToggleButtonsState } from '../ui.js';
import { saveFilterState } from '../data.js';

export const moveToLocation = (latlng, marker = null, regionName = null) => {
    if (!state.map) return;

    if (regionName && !state.activeRegionNames.has(regionName)) {
        state.activeRegionNames.add(regionName);
        const regBtns = document.querySelectorAll('#region-list .cate-item');
        regBtns.forEach(btn => {
            if (btn.dataset.region === regionName) {
                btn.classList.add('active');
            }
        });
        updateToggleButtonsState();
        saveFilterState();
    }

    const currentZoom = state.map.getZoom();
    const targetZoom = currentZoom > 11 ? currentZoom : 11;
    state.map.flyTo(latlng, targetZoom, { animate: true, duration: 0.8 });
    if (marker) {
        const catId = marker.options.alt;
        if (!state.activeCategoryIds.has(catId)) {
            state.activeCategoryIds.add(catId);
            const btn = document.querySelector(`.cate-item[data-id="${catId}"]`);
            if (btn) btn.classList.add('active');
        }
        if (!state.map.hasLayer(marker)) state.map.addLayer(marker);
        setTimeout(() => marker.openPopup(), 300);
    }
};

export const initReportPage = () => {
    window.openReportPage = (itemId) => {
        const item = state.allMarkers.find(m => m.id === itemId);
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
        }
    };
};
