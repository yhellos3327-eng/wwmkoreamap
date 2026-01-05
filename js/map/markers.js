import { state, setState } from '../state.js';
import { refreshSidebarLists } from '../ui.js';
import { markerPool } from './MarkerPool.js';
import { renderRegionPolygons } from './regions.js';
import { spatialIndex } from './SpatialIndex.js';
import { logger } from '../logger.js';
import { createMarkerForItem, setRegionPolygonsCache } from './markerFactory.js';
import { webWorkerManager } from '../web-worker-manager.js';
import {
    isGpuRenderingAvailable,
    renderMarkersWithPixi,
    clearPixiOverlay,
    showRenderModeIndicator
} from './pixiOverlay.js';

export { showCompletedTooltip, hideCompletedTooltip } from './completedTooltip.js';


const VIEWPORT_PADDING = 0.3;
const MAX_MARKERS_PER_FRAME = 50;

export const initLazyLoading = async () => {
    const items = state.mapData.items;

    if (webWorkerManager.isSupported) {
        const result = await webWorkerManager.buildSpatialIndex(items);
        if (result && result.success) {
            logger.success('LazyLoading', `워커 공간 인덱스 생성 완료: ${result.count} items`);
        }
    } else {
        spatialIndex.buildIndex(items);
        const stats = spatialIndex.getStats();
        logger.success('LazyLoading', `공간 인덱스 생성 (메인 스레드): ${stats.totalItems} items in ${stats.cellCount} cells`);
    }

    const filteredRegions = state.regionData;
    const regionPolygonsCache = renderRegionPolygons(filteredRegions);
    setRegionPolygonsCache(regionPolygonsCache);

    state.uniqueRegions.clear();
    items.forEach(item => {
        const effectiveRegion = item.forceRegion || item.region || "알 수 없음";

        const normalizedRegion = state.reverseRegionMap[effectiveRegion] || effectiveRegion;
        state.uniqueRegions.add(normalizedRegion);
    });
};

export const renderMapDataAndMarkers = async () => {
    const isGpuMode = state.gpuRenderMode && isGpuRenderingAvailable();

    if (isGpuMode) {
        console.log('%c[Markers] 🚀 GPU 모드로 렌더링 시작...', 'color: #4CAF50; font-weight: bold;');
        logger.log('Markers', 'Rendering with GPU mode (PixiOverlay)');

        if (state.markerClusterGroup) {
            state.markerClusterGroup.clearLayers();
            if (state.map.hasLayer(state.markerClusterGroup)) {
                state.map.removeLayer(state.markerClusterGroup);
            }
        }

        if (state.allMarkers) {
            state.allMarkers.forEach(item => {
                if (item.marker && state.map.hasLayer(item.marker)) {
                    state.map.removeLayer(item.marker);
                }
            });
        }

        markerPool.clearAll();
        state.allMarkers = new Map();
        setState('pendingMarkers', []);
        setState('visibleMarkerIds', new Set());

        await initLazyLoading();

        await renderMarkersWithPixi(state.mapData.items);

        refreshSidebarLists();
        return;
    }

    console.log('%c[Markers] 🖥️ CPU 모드 렌더링', 'color: #2196F3; font-weight: bold;');
    logger.log('Markers', 'Rendering with CPU mode (Leaflet markers)');

    clearPixiOverlay();

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
    state.allMarkers = new Map();
    setState('pendingMarkers', []);
    setState('visibleMarkerIds', new Set());

    await initLazyLoading();

    if (state.enableClustering) {
        showRenderModeIndicator('CPU');
        renderAllMarkersForClustering();
    } else {
        showRenderModeIndicator('CPU');
        updateViewportMarkers();
    }

    refreshSidebarLists();
};

const renderAllMarkersForClustering = () => {
    clearPixiOverlay();

    if (state.markerClusterGroup) {
        state.markerClusterGroup.clearLayers();
    }

    const filteredItems = state.mapData.items;
    const markersToAdd = [];

    filteredItems.forEach(item => {
        const markerData = createMarkerForItem(item);
        if (markerData) {
            markersToAdd.push(markerData.marker);
            state.allMarkers.set(markerData.markerInfo.id, markerData.markerInfo);
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
    if (state.gpuRenderMode && isGpuRenderingAvailable()) return;
    if (!state.map || state.enableClustering || state.isDragging) return;

    // Low Spec Mode Optimization: Hide markers at low zoom levels
    if (!state.gpuRenderMode && state.map.getZoom() < 5) {
        const visibleMarkerIds = state.visibleMarkerIds || new Set();
        visibleMarkerIds.forEach(id => {
            const markerInfo = state.allMarkers.get(id);
            if (markerInfo && state.map.hasLayer(markerInfo.marker)) {
                state.map.removeLayer(markerInfo.marker);
            }
        });
        setState('visibleMarkerIds', new Set());
        return;
    }

    performViewportUpdate();
};

const performViewportUpdate = async () => {
    const bounds = state.map.getBounds();
    const visibleMarkerIds = state.visibleMarkerIds || new Set();
    const newVisibleIds = new Set();

    let visibleItems = [];

    if (webWorkerManager.isSupported) {
        visibleItems = await webWorkerManager.filterByBounds(state.mapData.items, {
            south: bounds.getSouth(),
            north: bounds.getNorth(),
            west: bounds.getWest(),
            east: bounds.getEast()
        }, VIEWPORT_PADDING);
    } else {
        visibleItems = spatialIndex.getItemsInBounds(bounds, VIEWPORT_PADDING);
    }

    renderMarkersInChunks(visibleItems, visibleMarkerIds, newVisibleIds, 0);
};

const renderMarkersInChunks = (visibleItems, oldVisibleIds, newVisibleIds, startIndex) => {
    let addedCount = 0;
    let currentIndex = startIndex;

    while (currentIndex < visibleItems.length && addedCount < MAX_MARKERS_PER_FRAME) {
        const item = visibleItems[currentIndex];
        const existingMarker = state.allMarkers.get(item.id);

        if (existingMarker) {
            newVisibleIds.add(item.id);
            if (!state.map.hasLayer(existingMarker.marker)) {
                state.map.addLayer(existingMarker.marker);
            }
        } else {
            const markerData = createMarkerForItem(item);
            if (markerData) {
                newVisibleIds.add(item.id);
                state.allMarkers.set(markerData.markerInfo.id, markerData.markerInfo);
                state.map.addLayer(markerData.marker);
                addedCount++;
            }
        }
        currentIndex++;
    }

    if (currentIndex < visibleItems.length) {
        requestAnimationFrame(() => {
            renderMarkersInChunks(visibleItems, oldVisibleIds, newVisibleIds, currentIndex);
        });
    } else {
        oldVisibleIds.forEach(id => {
            if (!newVisibleIds.has(id)) {
                const markerInfo = state.allMarkers.get(id);
                if (markerInfo && state.map.hasLayer(markerInfo.marker)) {
                    state.map.removeLayer(markerInfo.marker);
                }
            }
        });
        setState('visibleMarkerIds', newVisibleIds);
    }
};

export const forceFullRender = () => {
    if (state.gpuRenderMode && isGpuRenderingAvailable()) return;
    if (state.enableClustering) return;

    const allItems = state.mapData.items;
    allItems.forEach(item => {
        const existingMarker = state.allMarkers.get(item.id);
        if (!existingMarker) {
            const markerData = createMarkerForItem(item);
            if (markerData) {
                state.allMarkers.set(markerData.markerInfo.id, markerData.markerInfo);
            }
        }
    });
};
