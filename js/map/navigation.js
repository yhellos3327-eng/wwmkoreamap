import { state } from '../state.js';
import { updateToggleButtonsState } from '../ui/sidebar.js';
import { saveFilterState } from '../data.js';
import { isGpuRenderingAvailable, showPopupForSprite } from './pixiOverlay.js';

export const moveToLocation = (latlng, marker = null, regionName = null, itemId = null) => {
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

    // GPU Mode handling
    if (state.gpuRenderMode && isGpuRenderingAvailable()) {
        const id = itemId || (marker && marker.markerData ? marker.markerData.item.id : null);
        if (id) {
            const sprite = state.pixiContainer?.children.find(s => s.markerData && String(s.markerData.item.id) === String(id));
            if (sprite) {
                setTimeout(() => showPopupForSprite(sprite), 300);
            }
        }
        return;
    }

    // CPU Mode handling
    if (marker) {
        const catId = marker.options.alt;
        if (catId && !state.activeCategoryIds.has(catId)) {
            state.activeCategoryIds.add(catId);
            const btn = document.querySelector(`.cate-item[data-id="${catId}"]`);
            if (btn) btn.classList.add('active');
        }
        if (!state.map.hasLayer(marker)) state.map.addLayer(marker);
        setTimeout(() => marker.openPopup(), 300);
    }
};
