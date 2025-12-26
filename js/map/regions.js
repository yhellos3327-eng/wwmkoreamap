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

            polygon.regionTitle = region.title;

            polygon.on('click', function (e) {
                if (state.isDevMode) return;

                if (state.gpuRenderMode && isGpuRenderingAvailable()) {
                    const container = getPixiContainer();
                    if (container && container.children.length > 0) {
                        const clickLat = e.latlng.lat;
                        const clickLng = e.latlng.lng;
                        const zoom = state.map.getZoom();
                        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

                        const sprite = findSpriteAtPosition(container, clickLat, clickLng, hitRadiusDeg);

                        if (sprite) {
                            return;
                        }
                    }
                }

                const isPopupOpen = state.map._popup && state.map.hasLayer(state.map._popup);

                if (!isPopupOpen) {
                    state.map.panTo(this.getBounds().getCenter());
                    L.DomEvent.stopPropagation(e);
                }
            });

            polygon.on('contextmenu', function (e) {
                if (state.gpuRenderMode && isGpuRenderingAvailable()) {
                    const container = getPixiContainer();
                    if (container && container.children.length > 0) {
                        const clickLat = e.latlng.lat;
                        const clickLng = e.latlng.lng;
                        const zoom = state.map.getZoom();
                        const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

                        const sprite = findSpriteAtPosition(container, clickLat, clickLng, hitRadiusDeg);

                        if (sprite) {
                            return;
                        }
                    }
                }
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);

                if (state.activeRegionNames.size === 1 && state.activeRegionNames.has(region.title)) {
                    state.activeRegionNames.clear();
                    if (filteredRegions && Array.isArray(filteredRegions)) {
                        filteredRegions.forEach(r => state.activeRegionNames.add(r.title));
                    } else if (state.mapData && state.mapData.regions) {
                        state.mapData.regions.forEach(r => state.activeRegionNames.add(r.title));
                    }
                } else {
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
