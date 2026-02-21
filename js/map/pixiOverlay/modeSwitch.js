// @ts-check
import { state } from "../../state.js";
import { logger } from "../../logger.js";
import {
  isGpuRenderingAvailable,
  renderMarkersWithPixi,
  clearPixiOverlay,
} from "./overlayCore.js";

/**
 * GPU 모드로 전환합니다.
 * @returns {Promise<boolean>} 성공 시 true.
 */
export const switchToGpuMode = async () => {
  if (!isGpuRenderingAvailable()) {
    logger.warn("ModeSwitch", "GPU rendering not available");
    return false;
  }

  if (
    state.markerClusterGroup &&
    state.map.hasLayer(state.markerClusterGroup)
  ) {
    state.map.removeLayer(state.markerClusterGroup);
  }

  if (state.allMarkers) {
    state.allMarkers.forEach((item) => {
      if (item.marker && state.map.hasLayer(item.marker)) {
        state.map.removeLayer(item.marker);
      }
    });
  }

  const items = state.mapData?.items || [];
  await renderMarkersWithPixi(items);

  logger.success("ModeSwitch", "Switched to GPU mode");
  return true;
};

/**
 * CPU 모드로 전환합니다.
 */
export const switchToCpuMode = () => {
  clearPixiOverlay();
  logger.success("ModeSwitch", "Switched to CPU mode");
};
