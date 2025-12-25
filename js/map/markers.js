import { state, setState } from '../state.js';
import { refreshSidebarLists } from '../ui.js';
import { markerPool } from './MarkerPool.js';
import { renderRegionPolygons } from './regions.js';
import { spatialIndex } from './SpatialIndex.js';
import { logger } from '../logger.js';
import { createMarkerForItem, setRegionPolygonsCache } from './markerFactory.js';

export { showCompletedTooltip, hideCompletedTooltip } from './completedTooltip.js';

let debounceTimer = null;
const DEBOUNCE_DELAY = 100;
const VIEWPORT_PADDING = 0.3;
const MAX_MARKERS_PER_FRAME = 50;

export const initLazyLoading = () => {
    const items = state.mapData.items;
    spatialIndex.buildIndex(items);

    const filteredRegions = state.regionData;
    const regionPolygonsCache = renderRegionPolygons(filteredRegions);
    setRegionPolygonsCache(regionPolygonsCache);

    state.uniqueRegions.clear();
    items.forEach(item => {
        const region = item.forceRegion || item.region || "알 수 없음";
        state.uniqueRegions.add(region);
    });

    const stats = spatialIndex.getStats();
    logger.success('LazyLoading', `공간 인덱스 생성: ${stats.totalItems} items in ${stats.cellCount} cells`);
};

export const renderMapDataAndMarkers = () => {
    if (state.markerClusterGroup) {
        state.markerClusterGroup.clearLayers();
    }

    if (state.allMarkers) {
        state.allMarkers.forEach(item => {
            if (item.marker && state.map.hasLayer(item.marker)) {
                state.map.removeLayer(item.marker);
            }
        });
    }

    markerPool.clearAll();
    state.allMarkers = [];
    setState('pendingMarkers', []);
    setState('visibleMarkerIds', new Set());

    initLazyLoading();

    if (state.enableClustering) {
        renderAllMarkersForClustering();
    } else {
        updateViewportMarkers();
    }

    refreshSidebarLists();
};

const renderAllMarkersForClustering = () => {
    const filteredItems = state.mapData.items;
    const markersToAdd = [];

    filteredItems.forEach(item => {
        const markerData = createMarkerForItem(item);
        if (markerData) {
            markersToAdd.push(markerData.marker);
            state.allMarkers.push(markerData.markerInfo);
        }
    });

    if (state.markerClusterGroup) {
        state.markerClusterGroup.addLayers(markersToAdd);
        if (!state.map.hasLayer(state.markerClusterGroup)) {
            state.map.addLayer(state.markerClusterGroup);
        }
    }
};

export const updateViewportMarkers = () => {
    if (!state.map || state.enableClustering) return;

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        performViewportUpdate();
    }, DEBOUNCE_DELAY);
};

const performViewportUpdate = () => {
    const bounds = state.map.getBounds();
    const visibleMarkerIds = state.visibleMarkerIds || new Set();
    const newVisibleIds = new Set();

    const visibleItems = spatialIndex.getItemsInBounds(bounds, VIEWPORT_PADDING);

    let addedCount = 0;

    visibleItems.forEach(item => {
        const existingMarker = state.allMarkers.find(m => m.id === item.id);

        if (existingMarker) {
            newVisibleIds.add(item.id);
            if (!state.map.hasLayer(existingMarker.marker)) {
                state.map.addLayer(existingMarker.marker);
            }
        } else {
            if (addedCount < MAX_MARKERS_PER_FRAME) {
                const markerData = createMarkerForItem(item);
                if (markerData) {
                    newVisibleIds.add(item.id);
                    state.allMarkers.push(markerData.markerInfo);
                    state.map.addLayer(markerData.marker);
                    addedCount++;
                }
            }
        }
    });

    visibleMarkerIds.forEach(id => {
        if (!newVisibleIds.has(id)) {
            const markerInfo = state.allMarkers.find(m => m.id === id);
            if (markerInfo && state.map.hasLayer(markerInfo.marker)) {
                state.map.removeLayer(markerInfo.marker);
            }
        }
    });

    setState('visibleMarkerIds', newVisibleIds);

    if (addedCount >= MAX_MARKERS_PER_FRAME) {
        requestAnimationFrame(() => {
            performViewportUpdate();
        });
    }
};

export const forceFullRender = () => {
    if (state.enableClustering) return;

    const allItems = state.mapData.items;
    allItems.forEach(item => {
        const existingMarker = state.allMarkers.find(m => m.id === item.id);
        if (!existingMarker) {
            const markerData = createMarkerForItem(item);
            if (markerData) {
                state.allMarkers.push(markerData.markerInfo);
            }
        }
    });
};
