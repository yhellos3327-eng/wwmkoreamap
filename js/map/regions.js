import { state } from '../state.js';
import { t, isPointInPolygon } from '../utils.js';
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

            const regionItems = state.mapData.items.filter(item => {
                const effectiveRegion = item.forceRegion || item.region;
                return effectiveRegion === region.title;
            });

            const totalItems = regionItems.length;
            const completedItems = regionItems.filter(item =>
                state.completedList.some(completed => String(completed.id) === String(item.id))
            ).length;

            const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            const tooltipContent = `
                <div class="region-tooltip-title">${translatedRegionName}</div>
                <div class="region-tooltip-progress">${completedItems}/${totalItems} (${percentage}%)</div>
            `;

            polygon.bindTooltip(tooltipContent, {
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
                if (state.isDevMode) {
                    if (window.dev && typeof window.dev.isRegionMode === 'function' && window.dev.isRegionMode()) {
                        window.dev.loadRegion(region);
                        L.DomEvent.stopPropagation(e);
                    }
                    return;
                }

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

export const updateRegionOverlay = () => {
    const map = state.map;
    if (!map) return;

    const zoom = map.getZoom();
    const overlay = document.getElementById('region-info-overlay');
    const nameEl = overlay.querySelector('.region-info-name');
    const progressEl = overlay.querySelector('.region-info-progress');
    const tooltipPane = map.getPane('tooltipPane');

    // Zoom threshold to switch between tooltip and overlay
    const ZOOM_THRESHOLD = 14;

    if (zoom >= ZOOM_THRESHOLD) {
        // Hide tooltips
        if (tooltipPane) tooltipPane.style.display = 'none';

        // Show overlay
        const center = map.getCenter();
        let foundRegion = null;

        // Find region containing center
        if (state.regionLayerGroup) {
            state.regionLayerGroup.eachLayer(layer => {
                if (layer instanceof L.Polygon) {
                    // Check bounds first for performance
                    if (layer.getBounds().contains(center)) {
                        // Precise check using isPointInPolygon
                        // Handle different polygon structures (Simple vs Multi)
                        const latlngs = layer.getLatLngs();
                        let coords = [];

                        // Leaflet 1.x: 
                        // Simple Polygon: [LatLng, LatLng, ...] (No, actually [ [LatLng, ...] ] for first ring)
                        // MultiPolygon: [ [ [LatLng, ...] ], ... ]

                        // Normalize to array of rings or array of polygons
                        // We need to check if point is in ANY of the polygons/rings

                        // Helper to convert LatLng[] to [lat, lng][]
                        const toPoints = (arr) => arr.map(c => [c.lat, c.lng]);

                        let isInside = false;

                        if (Array.isArray(latlngs)) {
                            // Check if it's a simple polygon (array of LatLngs) or nested
                            // Actually L.Polygon usually returns array of arrays (rings)
                            // If simple polygon: [ [LatLng, ...] ]
                            // If multipolygon: [ [ [LatLng, ...] ], ... ]

                            const flattenAndCheck = (arr) => {
                                if (arr.length === 0) return false;
                                // Check if first element is LatLng
                                if (arr[0].lat !== undefined) {
                                    // It's a ring (array of LatLngs)
                                    return isPointInPolygon([center.lat, center.lng], toPoints(arr));
                                } else if (Array.isArray(arr[0])) {
                                    // It's an array of rings or polygons
                                    return arr.some(subArr => flattenAndCheck(subArr));
                                }
                                return false;
                            };

                            isInside = flattenAndCheck(latlngs);
                        }

                        if (isInside) {
                            foundRegion = layer;
                        }
                    }
                }
            });
        }

        if (foundRegion) {
            // @ts-ignore
            const title = foundRegion.regionTitle;
            const translatedName = t(title);

            const regionItems = state.mapData.items.filter(item => {
                const effectiveRegion = item.forceRegion || item.region;
                return effectiveRegion === title;
            });

            const totalItems = regionItems.length;
            const completedItems = regionItems.filter(item =>
                state.completedList.some(completed => String(completed.id) === String(item.id))
            ).length;

            const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            nameEl.textContent = translatedName;
            progressEl.textContent = `${completedItems}/${totalItems} (${percentage}%)`;

            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }

    } else {
        // Show tooltips
        if (tooltipPane) tooltipPane.style.display = 'block';
        // Hide overlay
        overlay.classList.add('hidden');
    }
};
