// @ts-check
import { state } from "../state.js";
import { updateToggleButtonsState } from "../ui/sidebar.js";
import { saveFilterState } from "../data.js";
import { isGpuRenderingAvailable, showPopupForSprite } from "./pixiOverlay.js";

/**
 * Moves the map to a specific location and optionally opens a marker popup.
 * @param {any} latlng - The target latitude and longitude.
 * @param {any} [marker] - The marker to focus on.
 * @param {string} [regionName] - The region name to activate.
 * @param {string|number} [itemId] - The item ID to focus on (for GPU mode).
 */
export const moveToLocation = (
  latlng,
  marker = null,
  regionName = null,
  itemId = null,
) => {
  if (!state.map) return;

  if (regionName && !state.activeRegionNames.has(regionName)) {
    state.activeRegionNames.add(regionName);
    const regBtns = document.querySelectorAll("#region-list .cate-item");
    regBtns.forEach((btn) => {
      if (/** @type {HTMLElement} */ (btn).dataset.region === regionName) {
        btn.classList.add("active");
      }
    });
    updateToggleButtonsState();
    saveFilterState();
  }

  const currentZoom = state.map.getZoom();
  const targetZoom = currentZoom > 11 ? currentZoom : 11;
  state.map.flyTo(latlng, targetZoom, { animate: true, duration: 0.8 });

  if (isGpuRenderingAvailable()) {
    const id =
      itemId ||
      (marker && marker.markerData ? marker.markerData.item.id : null);
    if (id) {
      const sprite = state.pixiContainer?.children.find(
        (s) => s.markerData && String(s.markerData.item.id) === String(id),
      );
      if (sprite) {
        setTimeout(() => showPopupForSprite(sprite), 300);
      }
    }
    return;
  }

  if (marker) {
    const catId = marker.options.alt;
    if (catId && !state.activeCategoryIds.has(catId)) {
      state.activeCategoryIds.add(catId);
      const btn = document.querySelector(`.cate-item[data-id="${catId}"]`);
      if (btn) btn.classList.add("active");
    }

    if (state.enableClustering && state.markerClusterGroup) {
      state.markerClusterGroup.zoomToShowLayer(marker, () => {
        setTimeout(() => marker.openPopup(), 100);
      });
    } else {
      if (!state.map.hasLayer(marker)) state.map.addLayer(marker);
      setTimeout(() => marker.openPopup(), 300);
    }
  }
};
