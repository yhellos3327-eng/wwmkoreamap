import { renderMapDataAndMarkers } from './markers.js';

export const updateMapVisibility = () => {
    if (document.querySelector('.leaflet-popup')) return;
    renderMapDataAndMarkers();
};
