import { ICON_MAPPING } from '../config.js';
import { state, setState } from '../state.js';
import { isPointInPolygon } from '../utils.js';
import { refreshSidebarLists } from '../ui.js';
import { markerPool } from './MarkerPool.js';
import { createPopupHtml } from './popup.js';
import { renderRegionPolygons } from './regions.js';
import { updateViewportMarkers } from './viewport.js';

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

    const filteredItems = state.mapData.items;
    const filteredRegions = state.regionData;

    // 지역 폴리곤 렌더링
    const regionPolygons = renderRegionPolygons(filteredRegions);

    state.uniqueRegions.clear();

    const markersToAdd = [];

    filteredItems.forEach(item => {
        let catId = item.category;

        if (typeof ICON_MAPPING !== 'undefined' && ICON_MAPPING.hasOwnProperty(catId)) {
            const mappedValue = ICON_MAPPING[catId];
            if (mappedValue === null) {
                return;
            }
            catId = mappedValue;
        }

        const lat = parseFloat(item.x);
        const lng = parseFloat(item.y);

        let finalRegionName = item.forceRegion || item.region || "알 수 없음";

        if (!item.forceRegion) {
            let physicallyInRegion = null;
            for (const polyObj of regionPolygons) {
                if (isPointInPolygon([lat, lng], polyObj.coords)) {
                    physicallyInRegion = polyObj.title;
                    break;
                }
            }

            if (physicallyInRegion) {
                finalRegionName = physicallyInRegion;
                item.region = physicallyInRegion;
            }
        } else {
            item.region = item.forceRegion;
        }

        if (finalRegionName) state.uniqueRegions.add(finalRegionName);
        const isCatActive = state.activeCategoryIds.has(catId);
        const isRegActive = state.activeRegionNames.has(finalRegionName);

        if (!isCatActive || !isRegActive) return;

        const isCompleted = state.completedList.includes(item.id);
        if (state.hideCompleted && isCompleted) return;

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

        if (isDefault) {
            iconClass += ' blue-overlay';
        }

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
            if (e && e.originalEvent) {
                e.originalEvent.stopPropagation();
            }
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

                let rowIndex = -1;

                if (keyIdx !== -1) {
                    rowIndex = state.parsedCSV.findIndex(r => r[keyIdx] == item.id);
                }

                if (rowIndex === -1 && keyIdx !== -1) {
                    rowIndex = state.parsedCSV.findIndex(r => r[keyIdx] === item.name || r[keyIdx] === item.name?.trim());
                }

                if (rowIndex !== -1) {
                    const row = state.parsedCSV[rowIndex];

                    const rawLines = state.rawCSV.split(/\r?\n/);
                    const rawLine = rawLines[rowIndex];

                    console.log("%cFound Row in CSV", "font-size: 16px; font-weight: bold; color: #2196F3; border-bottom: 2px solid #2196F3; padding-bottom: 4px; margin-bottom: 8px; display: block;");

                    console.log("%cParsed CSV Data", "font-weight:bold; color: #90CAF9; margin-bottom: 4px;");

                    headers.forEach((h, i) => {
                        let val = row[i];
                        if (h === 'Description' && val) val = val.trim();
                        console.log(`%c${h.padEnd(12)}%c${val}`,
                            "color: #aaa; font-family: monospace; font-weight: bold; background: #222; padding: 2px 6px; border-radius: 3px 0 0 3px;",
                            "color: #fff; font-family: monospace; background: #333; padding: 2px 8px; border-radius: 0 3px 3px 0;"
                        );
                    });

                    if (rawLine) {
                        console.log("%cRaw CSV Line", "font-size: 14px; font-weight: bold; color: #FF5722; border-bottom: 2px solid #FF5722; padding-bottom: 4px; margin-bottom: 8px; display: block;");
                        console.log(`%c${rawLine}`, "background: #2d2d2d; color: #e0e0e0; padding: 8px 12px; border-radius: 4px; font-family: monospace; border: 1px solid #444; display: block; margin-top: 4px; line-height: 1.5; white-space: pre-wrap;");
                    }
                } else {
                    console.log("%cItem ID/Name not found directly in CSV", "color: orange;");
                    console.log("Searched for ID:", item.id, "or Name:", item.name);
                }
                console.groupEnd();
            }
            console.groupEnd();
        });

        marker.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            if (marker.isPopupOpen()) marker.closePopup();
            window.toggleCompleted(item.id);
        });

        marker.on('popupopen', () => {
            if (window.loadComments) {
                window.loadComments(item.id);
            }
        });

        marker.bindPopup(() => createPopupHtml(item, lat, lng, finalRegionName));

        markersToAdd.push(marker);

        state.allMarkers.push({
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
        });
    });

    // 기존에 개별적으로 추가된 마커들 무조건 제거 (상태 전환 및 필터 변경 대비)
    if (state.pendingMarkers) {
        state.pendingMarkers.forEach(m => {
            if (state.map.hasLayer(m)) state.map.removeLayer(m);
        });
    }

    if (state.enableClustering && state.markerClusterGroup) {
        state.markerClusterGroup.addLayers(markersToAdd);
        if (!state.map.hasLayer(state.markerClusterGroup)) {
            state.map.addLayer(state.markerClusterGroup);
        }
        setState('pendingMarkers', []);
    } else {
        if (state.markerClusterGroup && state.map.hasLayer(state.markerClusterGroup)) {
            state.map.removeLayer(state.markerClusterGroup);
        }

        setState('pendingMarkers', markersToAdd);
        updateViewportMarkers();
    }
    refreshSidebarLists();
};
