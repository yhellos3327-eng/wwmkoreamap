import { MAP_CONFIGS, ICON_MAPPING } from './config.js';
import { state, setState } from './state.js';
import { t, getJosa, isPointInPolygon } from './utils.js';
import { toggleSidebar, refreshSidebarLists, updateToggleButtonsState } from './ui.js';
import { saveFilterState } from './data.js';
// import { loadExternalContent } from './external-loader.js';

export const createPopupHtml = (item, lat, lng, regionName) => {
    const isFav = state.favorites.includes(item.id);
    const isCompleted = state.completedList.includes(item.id);
    const displayRegion = item.forceRegion || regionName;
    let translatedName = t(item.name);
    if (translatedName) {
        translatedName = translatedName.replace(/{region}/g, displayRegion);
    }
    const categoryName = t(item.category);

    let itemDescription = (item.description || '').trim()
    let replaceName = translatedName;
    const josa = typeof getJosa === 'function' ? getJosa(translatedName, '으로/로') : '로';
    replaceName = translatedName + josa;

    let isExternalContent = false;
    if (itemDescription && (itemDescription.startsWith('http://') || itemDescription.startsWith('https://') || itemDescription.startsWith('json:'))) {
        isExternalContent = true;
    }

    if (!isExternalContent) {
        if (itemDescription) {
            itemDescription = itemDescription.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--accent); text-decoration: underline;">$1</a>');
            itemDescription = itemDescription.replace(/\n/g, '<br>');
            itemDescription = itemDescription.replace(/{name}/g, replaceName);
            itemDescription = itemDescription.replace(/{region}/g, displayRegion);
        } else {
            itemDescription = '<p class="no-desc">설명 없음</p>';
        }
    }

    let imageSliderHtml = '';
    const imgs = item.images || [];
    if (imgs.length > 0) {
        const slides = imgs.map((src, index) => {
            const activeClass = index === 0 ? 'active' : '';
            const imgSrc = src.startsWith('http') ? src : src;
            return `<img src="${imgSrc}" class="popup-image ${activeClass}" onclick="window.openLightbox(${item.id}, ${index})" alt="${translatedName}">`;
        }).join('');
        const navBtns = imgs.length > 1 ? `
            <button class="img-nav-btn prev" onclick="event.stopPropagation(); window.switchImage(this, -1)" style="display:block">❮</button>
            <button class="img-nav-btn next" onclick="event.stopPropagation(); window.switchImage(this, 1)" style="display:block">❯</button>
            <span class="img-counter">1 / ${imgs.length}</span>
        ` : '';
        imageSliderHtml = `
            <div class="popup-image-container" data-idx="0" data-total="${imgs.length}">
                ${slides}
                ${navBtns}
            </div>
        `;
    }

    let videoHtml = '';
    if (item.video_url && item.video_url.trim() !== "") {
        let rawUrl = item.video_url.trim();

        let videoSrc = rawUrl.replace(/^http:/, 'https:');
        if (videoSrc.startsWith('//')) {
            videoSrc = 'https:' + videoSrc;
        }

        let lightboxSrc = videoSrc;
        const separator = videoSrc.includes('?') ? '&' : '?';

        if (lightboxSrc.includes('bilibili.com')) {
            lightboxSrc = lightboxSrc.replace(/&?autoplay=\d/, '');
            lightboxSrc += `${separator}autoplay=1&high_quality=1`;
        }

        let thumbSrc = videoSrc;
        if (thumbSrc.includes('bilibili.com')) {
            thumbSrc = thumbSrc.replace(/&?autoplay=\d/, '');
            thumbSrc += `${separator}autoplay=0&t=0&danmaku=0&high_quality=1&muted=1`;
        }

        videoHtml = `
            <div class="popup-video-thumbnail" onclick="window.openVideoLightbox('${lightboxSrc}')" style="position:relative; width:100%; padding-bottom:56.25%; height:0; overflow:hidden; border:1px solid #444; border-radius:6px; cursor:pointer; background:#000;">
                <iframe 
                    src="${thumbSrc}" 
                    style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;" 
                    frameborder="0" 
                    scrolling="no"
                    allowfullscreen>
                </iframe>
                
                <div class="video-thumb-cover" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; z-index:2;">
                    <div class="video-play-icon" style="font-size:40px; color:white; text-shadow:0 0 10px rgba(0,0,0,0.8); opacity:0.9;"></div>
                </div>
            </div>
        `;
    }

    let translateBtnHtml = '';
    if (!item.isTranslated && item.description && item.description.trim() !== "" && !isExternalContent) {
        translateBtnHtml = `
            <button class="btn-translate" onclick="window.translateItem(${item.id})" style="width:100%; margin-top:10px; padding:6px; background:var(--accent-bg); border:1px solid var(--accent); color:var(--accent); border-radius:4px; cursor:pointer;">
                ✨ AI 번역 (Chinese -> Korean)
            </button>
        `;
    }

    let relatedHtml = '';
    const relatedItems = state.itemsByCategory[item.category] || [];
    const filteredList = relatedItems.filter(i => i.id !== item.id);
    if (filteredList.length > 0) {
        const limit = 3;
        const hiddenCount = filteredList.length - limit;
        const listItemsHtml = filteredList.map((r, index) => {
            const hiddenClass = index >= limit ? 'hidden' : '';
            const rReg = r.forceRegion || r.region;
            let rName = t(r.name);
            if (rName) rName = rName.replace(/{region}/g, rReg);
            const rRegHtml = rReg ? `<span class="related-region">(${rReg})</span>` : '';
            return `<li class="related-item ${hiddenClass}" onclick="window.jumpToId(${r.id})">${rName} ${rRegHtml}</li>`;
        }).join('');
        const expandBtn = hiddenCount > 0
            ? `<button class="btn-expand" onclick="event.stopPropagation(); window.expandRelated(this)">▼ 더보기 (${hiddenCount}+)</button>`
            : '';
        relatedHtml = `
        <div class="popup-related">
            <div class="popup-related-header">
                <h5>관련 ${categoryName} (${filteredList.length})
                <button class="btn-search-modal" onclick="window.openRelatedModal('${item.category}')" title="전체 목록 검색">🔍</button></h5>
            </div>
            <ul class="related-list">${listItemsHtml}</ul>
            ${expandBtn}
        </div>
    `;
    }

    const contentId = `popup-content-${item.id}`;

    if (isExternalContent) {
        setTimeout(() => {
            const container = document.getElementById(contentId);
            if (container) {
                //loadExternalContent(itemDescription, container);
            }
        }, 100);
    }

    const bodyContent = isExternalContent
        ? `<div id="${contentId}"></div>`
        : (itemDescription.startsWith('<p') ? itemDescription : `<p>${itemDescription}</p>`);

    return `
    <div class="popup-container" data-id="${item.id}">
        <div class="popup-header">
            <div style="display: flex; align-items: center;">
                <img src="./icons/${item.category}.png" class="popup-icon" alt="${categoryName}" onerror="this.style.display='none'">
                <h4>${translatedName}</h4>
            </div>
        </div>
        <div class="popup-body">
            ${imageSliderHtml}
            ${videoHtml}
            ${bodyContent}
            ${translateBtnHtml}
        </div>
        ${relatedHtml}
        <div class="popup-actions">
            <button class="action-btn btn-fav ${isFav ? 'active' : ''}" onclick="window.toggleFavorite(${item.id})" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
            <button class="action-btn btn-complete ${isCompleted ? 'active' : ''}" onclick="window.toggleCompleted(${item.id})" title="완료 상태로 표시">${isCompleted ? '완료됨' : '완료 체크'}</button>
            <button class="action-btn btn-share" onclick="window.shareLocation(${item.id}, ${lat}, ${lng})" title="위치 공유">📤</button>
        </div>
        <div class="popup-footer">
            <div class="footer-badges">
                <span class="badge">${categoryName}</span>
                <span class="badge">${t(displayRegion)}</span>
            </div>
            <button class="btn-report-styled" onclick="window.openReportPage(${item.id})">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                오류 제보
            </button>
        </div>
    </div>
`;
};

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

        map.on('moveend', updateMapVisibility);
        map.on('zoomend', updateMapVisibility);
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
            maxClusterRadius: isMobile ? 80 : 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 16
        });
        state.map.addLayer(markerClusterGroup);
        setState('markerClusterGroup', markerClusterGroup);
    }
};

class MarkerPool {
    constructor() {
        this.pool = [];
        this.activeMarkers = new Map();
    }

    getMarker(lat, lng, options) {
        let marker;
        if (this.pool.length > 0) {
            marker = this.pool.pop();
            marker.setLatLng([lat, lng]);
            marker.setIcon(options.icon);
            marker.options.title = options.title;
            marker.options.alt = options.alt;
            marker.options.itemId = options.itemId;
        } else {
            marker = L.marker([lat, lng], options);
        }
        this.activeMarkers.set(options.itemId, marker);
        return marker;
    }

    releaseMarker(itemId) {
        const marker = this.activeMarkers.get(itemId);
        if (marker) {
            this.activeMarkers.delete(itemId);
            this.pool.push(marker);
            return marker;
        }
        return null;
    }

    clearAll() {
        this.activeMarkers.forEach(marker => {
            this.pool.push(marker);
        });
        this.activeMarkers.clear();
    }
}

const markerPool = new MarkerPool();

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
                L.DomEvent.stopPropagation(e);
                state.map.fitBounds(this.getBounds());
            });

            polygon.on('contextmenu', function (e) {
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);

                state.activeRegionNames.clear();
                state.activeRegionNames.add(region.title);

                updateMapVisibility();
                saveFilterState();
            });

            state.regionLayerGroup.addLayer(polygon);
        });
    }

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

        let finalRegionName = item.region || "알 수 없음";
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
            item.forceRegion = physicallyInRegion;
        }

        if (finalRegionName) state.uniqueRegions.add(finalRegionName);
        const isCatActive = state.activeCategoryIds.has(catId);
        const isRegActive = state.activeRegionNames.has(finalRegionName);

        if (!isCatActive || !isRegActive) return;

        const isCompleted = state.completedList.includes(item.id);
        if (state.hideCompleted && isCompleted) return;

        const categoryObj = state.mapData.categories.find(c => c.id === catId);

        let iconUrl = './icons/marker.png';
        if (categoryObj && categoryObj.image) {
            iconUrl = categoryObj.image;
        }

        const w = item.imageSizeW || 44;
        const h = item.imageSizeH || 44;
        const iconClass = isCompleted ? 'game-marker-icon completed-marker' : 'game-marker-icon';

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

    if (state.enableClustering && state.markerClusterGroup) {
        state.markerClusterGroup.addLayers(markersToAdd);
        if (!state.map.hasLayer(state.markerClusterGroup)) {
            state.map.addLayer(state.markerClusterGroup);
        }
    } else {
        if (state.markerClusterGroup && state.map.hasLayer(state.markerClusterGroup)) {
            state.map.removeLayer(state.markerClusterGroup);
        }
        markersToAdd.forEach(m => {
            if (!state.map.hasLayer(m)) state.map.addLayer(m);
        });
    }
    refreshSidebarLists();
};

export const updateMapVisibility = () => {
    if (document.querySelector('.leaflet-popup')) return;
    renderMapDataAndMarkers();
};

export const moveToLocation = (latlng, marker = null, regionName = null) => {
    if (!state.map) return;

    if (regionName && !state.activeRegionNames.has(regionName)) {
        state.activeRegionNames.add(regionName);
        const regBtns = document.querySelectorAll('#region-list .cate-item');
        regBtns.forEach(btn => {
            if (btn.dataset.region === regionName) {
                btn.classList.add('active');
            }
        });
        updateToggleButtonsState();
        saveFilterState();
    }

    const currentZoom = state.map.getZoom();
    const targetZoom = currentZoom > 12 ? currentZoom : 12;
    state.map.flyTo(latlng, targetZoom, { animate: true, duration: 0.8 });
    if (marker) {
        const catId = marker.options.alt;
        if (!state.activeCategoryIds.has(catId)) {
            state.activeCategoryIds.add(catId);
            const btn = document.querySelector(`.cate-item[data-id="${catId}"]`);
            if (btn) btn.classList.add('active');
        }
        if (!state.map.hasLayer(marker)) state.map.addLayer(marker);
        setTimeout(() => marker.openPopup(), 300);
    }
};

window.openReportPage = (itemId) => {
    const item = state.allMarkers.find(m => m.id === itemId);
    if (item) {
        const reportData = {
            id: item.id,
            name: item.originalName,
            category: item.category,
            region: item.region,
            description: item.desc,
            lat: item.lat,
            lng: item.lng
        };
        localStorage.setItem('wwm_report_target', JSON.stringify(reportData));
        window.open('report.html', '_blank');
    }
};
