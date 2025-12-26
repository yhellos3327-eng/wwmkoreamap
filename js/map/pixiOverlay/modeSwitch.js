/**
 * Mode Switch Module
 * Handles switching between GPU and CPU rendering modes
 */

import { state } from '../../state.js';
import { logger } from '../../logger.js';
import { isGpuRenderingAvailable, renderMarkersWithPixi, clearPixiOverlay } from './overlayCore.js';

/**
 * Switch to GPU rendering mode
 * @returns {Promise<boolean>} - True if switch was successful
 */
export const switchToGpuMode = async () => {
    if (!isGpuRenderingAvailable()) {
        logger.warn('ModeSwitch', 'GPU rendering not available');
        return false;
    }

    // Remove existing CPU markers
    if (state.markerClusterGroup && state.map.hasLayer(state.markerClusterGroup)) {
        state.map.removeLayer(state.markerClusterGroup);
    }

    if (state.allMarkers) {
        state.allMarkers.forEach(item => {
            if (item.marker && state.map.hasLayer(item.marker)) {
                state.map.removeLayer(item.marker);
            }
        });
    }

    // Initialize and render with GPU
    const items = state.mapData?.items || [];
    await renderMarkersWithPixi(items);

    logger.success('ModeSwitch', 'Switched to GPU mode');
    return true;
};

/**
 * Switch to CPU rendering mode
 */
export const switchToCpuMode = () => {
    clearPixiOverlay();
    logger.success('ModeSwitch', 'Switched to CPU mode');
};
