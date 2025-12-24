import { ICON_MAPPING } from '../config.js';
import { state, setState } from '../state.js';
import { isPointInPolygon } from '../utils.js';
import { refreshSidebarLists } from '../ui.js';
import { markerPool } from './MarkerPool.js';
import { createPopupHtml } from './popup.js';
import { renderRegionPolygons } from './regions.js';
import { spatialIndex } from './SpatialIndex.js';
import { logger } from '../logger.js';

let regionPolygonsCache = [];
let debounceTimer = null;
const DEBOUNCE_DELAY = 100;
const VIEWPORT_PADDING = 0.3;
const MAX_MARKERS_PER_FRAME = 50;

export const initLazyLoading = () => {
    const items = state.mapData.items;
    spatialIndex.buildIndex(items);

    const filteredRegions = state.regionData;
    regionPolygonsCache = renderRegionPolygons(filteredRegions);

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

const createMarkerForItem = (item) => {
    let catId = item.category;

    if (typeof ICON_MAPPING !== 'undefined' && ICON_MAPPING.hasOwnProperty(catId)) {
        const mappedValue = ICON_MAPPING[catId];
        if (mappedValue === null) return null;
        catId = mappedValue;
    }

    const lat = parseFloat(item.x);
    const lng = parseFloat(item.y);
    if (isNaN(lat) || isNaN(lng)) return null;

    let finalRegionName = item.forceRegion || item.region || "알 수 없음";

    if (!item.forceRegion && regionPolygonsCache.length > 0) {
        for (const polyObj of regionPolygonsCache) {
            if (isPointInPolygon([lat, lng], polyObj.coords)) {
                finalRegionName = polyObj.title;
                item.region = polyObj.title;
                break;
            }
        }
    }

    const isCatActive = state.activeCategoryIds.has(catId);
    const isRegActive = state.activeRegionNames.has(finalRegionName);

    if (!isCatActive || !isRegActive) return null;

    const isCompleted = state.completedList.includes(item.id);
    if (state.hideCompleted && isCompleted) return null;

    const categoryObj = state.mapData.categories.find(c => c.id === catId);
    let iconUrl = './icons/17310010088.png';
    let isDefault = true;

    if (categoryObj && categoryObj.image) {
        iconUrl = categoryObj.image;
        isDefault = false;
    }

    const w = item.imageSizeW || 44;
    const h = item.imageSizeH || 44;
    let iconClass = isCompleted ? 'game-marker-icon completed-marker' : 'game-marker-icon';
    if (isDefault) iconClass += ' blue-overlay';

    const customIcon = L.icon({
        iconUrl: iconUrl,
        iconSize: [w, h],
        iconAnchor: [w / 2, h / 2],
        popupAnchor: [0, -h / 2],
        className: iconClass
    });

    const marker = markerPool.getMarker(lat, lng, {
        icon: customIcon,
        title: item.name,
        alt: catId,
        itemId: item.id
    });

    marker.off('click');
    marker.off('contextmenu');
    marker.unbindPopup();

    marker.on('click', (e) => {
        if (e && e.originalEvent) e.originalEvent.stopPropagation();
        logMarkerDebugInfo(item, catId, finalRegionName, lat, lng);
    });

    marker.on('contextmenu', (e) => {
        e.originalEvent.preventDefault();
        if (marker.isPopupOpen()) marker.closePopup();
        window.toggleCompleted(item.id);
    });

    marker.on('popupopen', () => {
        if (window.loadComments) window.loadComments(item.id);
    });

    marker.bindPopup(() => createPopupHtml(item, lat, lng, finalRegionName));

    return {
        marker,
        markerInfo: {
            id: item.id,
            marker: marker,
            name: item.name.toLowerCase(),
            originalName: item.name,
            desc: (item.description || '').toLowerCase(),
            category: catId,
            region: finalRegionName,
            forceRegion: item.forceRegion,
            lat: lat,
            lng: lng
        }
    };
};

const logMarkerDebugInfo = (item, catId, finalRegionName, lat, lng) => {
    const debugInfo = {
        "ID": item.id,
        "Name": item.name,
        "Category (Mapped)": catId,
        "Category (Original)": item.category,
        "Region": finalRegionName,
        "Coordinates": `${lat}, ${lng}`
    };

    console.groupCollapsed(`%c📍 [${item.id}] ${item.name}`, "font-size: 14px; font-weight: bold; color: #ffbd53; background: #222; padding: 4px 8px; border-radius: 4px;");
    console.table(debugInfo);

    if (state.rawCSV && state.parsedCSV && state.parsedCSV.length > 0) {
        console.groupCollapsed("%c📄 CSV Source Data Available", "font-weight: bold; color: #4CAF50;");
        const headers = state.parsedCSV[0].map(h => h.trim());
        const keyIdx = headers.indexOf('Key');
        let rowIndex = keyIdx !== -1 ? state.parsedCSV.findIndex(r => r[keyIdx] == item.id) : -1;

        if (rowIndex === -1 && keyIdx !== -1) {
            rowIndex = state.parsedCSV.findIndex(r => r[keyIdx] === item.name || r[keyIdx] === item.name?.trim());
        }

        if (rowIndex !== -1) {
            const row = state.parsedCSV[rowIndex];
            const rawLines = state.rawCSV.split(/\r?\n/);
            const rawLine = rawLines[rowIndex];

            console.log("%cFound Row in CSV", "font-size: 16px; font-weight: bold; color: #2196F3;");
            headers.forEach((h, i) => {
                console.log(`%c${h.padEnd(12)}%c${row[i]}`, "color: #aaa;", "color: #fff;");
            });

            if (rawLine) {
                console.log("%cRaw CSV Line", "font-weight: bold; color: #FF5722;");
                console.log(rawLine);
            }
        }
        console.groupEnd();
    }
    console.groupEnd();
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
