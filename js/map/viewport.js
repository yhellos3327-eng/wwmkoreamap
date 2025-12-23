import { state } from '../state.js';

export const updateViewportMarkers = () => {
    if (!state.map || !state.pendingMarkers || state.enableClustering) return;

    const bounds = state.map.getBounds();
    const paddedBounds = bounds.pad(0.2);

    state.pendingMarkers.forEach(marker => {
        const latlng = marker.getLatLng();
        const isInView = paddedBounds.contains(latlng);

        if (isInView) {
            if (!state.map.hasLayer(marker)) state.map.addLayer(marker);
        } else {
            if (state.map.hasLayer(marker)) state.map.removeLayer(marker);
        }
    });
};
