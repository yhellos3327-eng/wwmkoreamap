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

let debounceTimer = null;
const DEBOUNCE_DELAY = 100;
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
        const region = item.forceRegion || item.region || "알 수 없음";
        state.uniqueRegions.add(region);
    });
};

export const renderMapDataAndMarkers = async () => {
    const isGpuMode = state.gpuRenderMode && isGpuRenderingAvailable();

    // === GPU MODE ===
    if (isGpuMode) {
        console.log('%c[Markers] 🚀 GPU 모드로 렌더링 시작...', 'color: #4CAF50; font-weight: bold;');
        logger.log('Markers', 'Rendering with GPU mode (PixiOverlay)');

        // Clear any existing CPU markers first
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
        state.allMarkers = [];
        setState('pendingMarkers', []);
        setState('visibleMarkerIds', new Set());

        // Initialize lazy loading for region data
        await initLazyLoading();

        // Render with GPU (createSpriteForItem is used internally)
        await renderMarkersWithPixi(state.mapData.items);

        refreshSidebarLists();
        return;
    }

    // === CPU MODE ===
    console.log('%c[Markers] 🖥️ CPU 모드 렌더링', 'color: #2196F3; font-weight: bold;');
    logger.log('Markers', 'Rendering with CPU mode (Leaflet markers)');

    // Clear PixiOverlay when in CPU mode
    clearPixiOverlay();

    // Clear existing CPU markers
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

    await initLazyLoading();

    // CPU mode uses createMarkerForItem
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
    // Skip in GPU mode - sprites are handled by PixiOverlay
    if (state.gpuRenderMode && isGpuRenderingAvailable()) return;
    if (!state.map || state.enableClustering || state.isDragging) return;

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        performViewportUpdate();
    }, DEBOUNCE_DELAY);
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
        const existingMarker = state.allMarkers.find(m => m.id === item.id);

        if (existingMarker) {
            newVisibleIds.add(item.id);
            if (!state.map.hasLayer(existingMarker.marker)) {
                state.map.addLayer(existingMarker.marker);
            }
        } else {
            const markerData = createMarkerForItem(item);
            if (markerData) {
                newVisibleIds.add(item.id);
                state.allMarkers.push(markerData.markerInfo);
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
                const markerInfo = state.allMarkers.find(m => m.id === id);
                if (markerInfo && state.map.hasLayer(markerInfo.marker)) {
                    state.map.removeLayer(markerInfo.marker);
                }
            }
        });
        setState('visibleMarkerIds', newVisibleIds);
    }
};

export const forceFullRender = () => {
    // Skip in GPU mode - sprites are handled by PixiOverlay
    if (state.gpuRenderMode && isGpuRenderingAvailable()) return;
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
