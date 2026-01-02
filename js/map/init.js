import { MAP_CONFIGS } from '../config.js';
import { state, setState } from '../state.js';
import { toggleSidebar } from '../ui.js';
import { updateViewportMarkers } from './viewport.js';
import { updateMapVisibility } from './visibility.js';

export const initMap = (mapKey) => {
    const config = MAP_CONFIGS[mapKey];
    if (!config) return;

    if (!state.map) {
        const isMobile = window.innerWidth <= 768;
        const initialZoom = isMobile ? config.zoom - 1 : config.zoom;

        const map = L.map('map', {
            center: config.center,
            zoom: initialZoom,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            zoomControl: false,
            attributionControl: false,
            maxBoundsViscosity: 1.0,
            preferCanvas: true,
            markerZoomAnimation: false
        });
        setState('map', map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        map.on('zoomend', () => {
            const zoom = map.getZoom();
            const mapContainer = map.getContainer();

            if (zoom < 4) {
                mapContainer.classList.add('low-quality-mode');
            } else {
                mapContainer.classList.remove('low-quality-mode');
            }

            if (state.enableClustering) {
                updateMapVisibility();
            } else {
                updateViewportMarkers();
            }
        });

        map.on('movestart', () => {
            setState('isDragging', true);
        });

        map.on('moveend', () => {
            setState('isDragging', false);
            if (state.enableClustering) {
                updateMapVisibility();
            } else {
                updateViewportMarkers();
            }
        });

        map.on('click', () => { if (window.innerWidth <= 768) toggleSidebar('close'); });
    } else {
        state.map.setView(config.center, config.zoom);
    }

    if (state.currentTileLayer) {
        state.map.removeLayer(state.currentTileLayer);
    }
    const tileLayer = L.tileLayer(config.tileUrl, {
        tms: false,
        noWrap: true,
        tileSize: 256,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
        maxNativeZoom: config.maxNativeZoom || config.maxZoom
    }).addTo(state.map);
    setState('currentTileLayer', tileLayer);

    if (state.regionLayerGroup) {
        state.regionLayerGroup.clearLayers();
    } else {
        const regionLayerGroup = L.layerGroup().addTo(state.map);
        setState('regionLayerGroup', regionLayerGroup);
    }

    if (!state.markerClusterGroup) {
        const isMobile = window.innerWidth <= 768;
        const markerClusterGroup = L.markerClusterGroup({
            maxClusterRadius: isMobile ? 40 : 30,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: false,
            disableClusteringAtZoom: 14,
            spiderfyDistanceMultiplier: 2
        });

        markerClusterGroup.on('clusterclick', function (a) {
            a.layer.spiderfy();
        });

        // Only add cluster group to map if not in GPU mode and clustering is enabled
        if (!state.gpuRenderMode && state.enableClustering) {
            state.map.addLayer(markerClusterGroup);
        }
        setState('markerClusterGroup', markerClusterGroup);
    }
};
