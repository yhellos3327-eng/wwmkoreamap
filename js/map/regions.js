import { state } from '../state.js';
import { t } from '../utils.js';
import { saveFilterState } from '../data.js';
import { updateMapVisibility } from './visibility.js';
import {
    isGpuRenderingAvailable,
    getPixiContainer,
    findSpriteAtPosition,
    calculateHitRadius
} from './pixiOverlay.js';

export const renderRegionPolygons = (filteredRegions) => {
    const regionPolygons = [];

    if (state.regionLayerGroup) {
        state.regionLayerGroup.clearLayers();
    }

    if (filteredRegions && Array.isArray(filteredRegions)) {
        filteredRegions.forEach(region => {
            if (!region.coordinates || region.coordinates.length === 0) return;

            const polygonCoords = region.coordinates.map(coord => [parseFloat(coord[1]), parseFloat(coord[0])]);
            const translatedRegionName = t(region.title);

            regionPolygons.push({
                title: region.title,
                coords: polygonCoords
            });

            const polygon = L.polygon(polygonCoords, {
                color: state.savedRegionColor,
                weight: 1,
                opacity: 1,
                fillColor: state.savedRegionFillColor,
                fillOpacity: 0.1,
                className: 'region-polygon'
            });

            polygon.bindTooltip(translatedRegionName, {
                permanent: true,
                direction: 'center',
                className: 'region-label'
            });

            polygon.on('mouseover', function () {
                this.setStyle({ weight: 2, fillOpacity: 0.4 });
            });

            polygon.on('mouseout', function () {
                this.setStyle({ weight: 1, fillOpacity: 0.1 });
            });

            polygon.on('click', function (e) {
                if (state.isDevMode) return;

                // Check if a GPU marker is under the cursor
                if (state.gpuRenderMode && isGpuRenderingAvailable()) {
                    const container = getPixiContainer();
                    if (container && container.children.length > 0) {
                        const clickLat = e.latlng.lat;
                        const clickLng = e.latlng.lng;
                        const zoom = state.map.getZoom();
                        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

                        const sprite = findSpriteAtPosition(container, clickLat, clickLng, hitRadiusDeg);

                        // If marker found, do NOT stop propagation (let eventHandler handle it)
                        // and do NOT fit bounds
                        if (sprite) {
                            return;
                        }
                    }
                }

                L.DomEvent.stopPropagation(e);
                state.map.fitBounds(this.getBounds());
            });

            polygon.on('contextmenu', function (e) {
                // Check if a GPU marker is under the cursor
                if (state.gpuRenderMode && isGpuRenderingAvailable()) {
                    const container = getPixiContainer();
                    if (container && container.children.length > 0) {
                        const clickLat = e.latlng.lat;
                        const clickLng = e.latlng.lng;
                        const zoom = state.map.getZoom();
                        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

                        const sprite = findSpriteAtPosition(container, clickLat, clickLng, hitRadiusDeg);

                        // If marker found, return immediately to let eventHandler handle it
                        if (sprite) {
                            return;
                        }
                    }
                }
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);

                // Toggle logic: If this region is the only one active, select all regions
                if (state.activeRegionNames.size === 1 && state.activeRegionNames.has(region.title)) {
                    // Select all regions
                    state.activeRegionNames.clear();
                    // Use filteredRegions which contains all regions for the current map
                    if (filteredRegions && Array.isArray(filteredRegions)) {
                        filteredRegions.forEach(r => state.activeRegionNames.add(r.title));
                    } else if (state.mapData && state.mapData.regions) {
                        // Fallback
                        state.mapData.regions.forEach(r => state.activeRegionNames.add(r.title));
                    }
                } else {
                    // Focus on this region only
                    state.activeRegionNames.clear();
                    state.activeRegionNames.add(region.title);
                }

                updateMapVisibility();
                saveFilterState();
            });

            state.regionLayerGroup.addLayer(polygon);
        });
    }

    return regionPolygons;
};
