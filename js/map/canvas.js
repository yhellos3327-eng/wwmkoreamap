// @ts-check
const L = /** @type {any} */ (window).L;

import { state, setState, getCategoryMap } from "../state.js";
import { logger } from "../logger.js";
import { ICON_MAPPING } from "../config.js";

let canvasLayer = null;
let iconCache = new Map();
let loadedIcons = new Set();
const ICON_SIZE = 32;
const DEFAULT_ICON_URL = "icons/17310010088.png";
let renderedMarkers = new Map();

/**
 * 아이콘 이미지를 미리 로드합니다.
 * @param {string} iconUrl - 아이콘의 URL.
 * @returns {Promise<boolean>} 아이콘 로드 성공 여부.
 */
const preloadIcon = (iconUrl) => {
  return new Promise((resolve) => {
    if (loadedIcons.has(iconUrl)) {
      resolve(true);
      return;
    }

    const img = new Image();
    img.onload = () => {
      loadedIcons.add(iconUrl);
      resolve(true);
    };
    img.onerror = () => {
      resolve(false);
    };
    img.src = iconUrl;
  });
};

/**
 * 카테고리 ID를 ICON_MAPPING에 따라 해석
 * @param {string} categoryId - 원본 카테고리 ID
 * @returns {string|null} - 해석된 카테고리 ID 또는 null(숨김 처리)
 */
const resolveCategoryId = (categoryId) => {
  if (ICON_MAPPING && ICON_MAPPING.hasOwnProperty(categoryId)) {
    return ICON_MAPPING[categoryId];
  }
  return categoryId;
};

/**
 * 카테고리 ID로 아이콘 URL 조회 (O(1) Map 조회)
 * @param {string} categoryId - 카테고리 ID
 * @returns {string|null} - 아이콘 URL 또는 null
 */
const getIconUrl = (categoryId) => {
  const finalCatId = resolveCategoryId(categoryId);
  if (finalCatId === null) return null;

  const categoryMap = getCategoryMap();
  if (categoryMap) {
    const catObj = categoryMap.get(finalCatId);
    if (catObj?.image) {
      return catObj.image;
    }
  }
  return DEFAULT_ICON_URL;
};

/**
 * 카테고리 ID로 Leaflet 아이콘 객체 반환 (캐싱 적용)
 * @param {string} categoryId - 카테고리 ID
 * @returns {any|null} - Leaflet 아이콘 또는 null
 */
const getIconForCategory = (categoryId) => {
  if (iconCache.has(categoryId)) {
    return iconCache.get(categoryId);
  }

  const iconUrl = getIconUrl(categoryId);
  if (iconUrl === null) return null;

  const icon = L.icon({
    iconUrl: iconUrl,
    iconSize: [ICON_SIZE, ICON_SIZE],
    iconAnchor: [ICON_SIZE / 2, ICON_SIZE],
    popupAnchor: [0, -ICON_SIZE],
  });

  iconCache.set(categoryId, icon);
  return icon;
};

/**
 * 마커 렌더링을 위한 캔버스 레이어를 초기화합니다.
 * @returns {any|null} 캔버스 레이어 또는 null.
 */
export const initCanvasLayer = () => {
  if (typeof L.canvasIconLayer === "undefined") {
    logger.warn("Canvas", "L.canvasIconLayer not available");
    return null;
  }

  if (canvasLayer && state.map && state.map.hasLayer(canvasLayer)) {
    return canvasLayer;
  }

  if (canvasLayer && state.map && !state.map.hasLayer(canvasLayer)) {
    canvasLayer.addTo(state.map);
    return canvasLayer;
  }

  canvasLayer = L.canvasIconLayer({});
  setState("canvasLayer", canvasLayer);

  canvasLayer.addOnClickListener((e, data) => {
    if (data && data.length > 0) {
      const marker = data[0];
      if (marker.itemData) {
        showCanvasMarkerPopup(marker, marker.itemData);
      }
    }
  });

  if (state.map) {
    canvasLayer.addTo(state.map);
  }

  if (canvasLayer._canvas) {
    canvasLayer._canvas.style.pointerEvents = "none";
  }

  logger.success("Canvas", "캔버스 레이어 초기화 완료");
  return canvasLayer;
};

/**
 * 캔버스 레이어에 마커를 렌더링합니다.
 * @param {any[]} items - 렌더링할 아이템 배열.
 * @returns {Promise<void>}
 */
export const renderMarkersOnCanvas = async (items) => {
  if (!canvasLayer) {
    initCanvasLayer();
    if (!canvasLayer) return;
  }
  const currentIds = new Set(items.map((i) => i.id));
  const markersToRemove = [];

  for (const [id, marker] of renderedMarkers) {
    if (!currentIds.has(id)) {
      markersToRemove.push(marker);
      renderedMarkers.delete(id);
    }
  }

  if (markersToRemove.length > 0) {
    if (canvasLayer.removeLayers) {
      canvasLayer.removeLayers(markersToRemove);
    } else {
      markersToRemove.forEach((m) => canvasLayer.removeMarker(m, false));
    }
  }

  const markersToAdd = [];
  const completedIds = new Set(state.completedList.map((c) => c.id));
  const itemsToAdd = items.filter((item) => !renderedMarkers.has(item.id));

  if (itemsToAdd.length > 0) {
    const uniqueIconUrls = new Set();
    itemsToAdd.forEach((item) => {
      const iconUrl = getIconUrl(item.category);
      uniqueIconUrls.add(iconUrl);
    });
    [...uniqueIconUrls].forEach((url) => preloadIcon(url));
    itemsToAdd.forEach((item) => {
      if (!item.x || !item.y) return;
      const lat = parseFloat(item.x);
      const lng = parseFloat(item.y);
      if (isNaN(lat) || isNaN(lng)) return;

      const icon = getIconForCategory(item.category);
      const isCompleted = completedIds.has(item.id);

      const marker = L.marker([lat, lng], {
        icon: icon,
        opacity: isCompleted ? 0.4 : 1.0,
      });

      marker.itemData = item;
      markersToAdd.push(marker);
      renderedMarkers.set(item.id, marker);
    });
  }

  if (markersToAdd.length > 0) {
    if (canvasLayer.addLayers) {
      canvasLayer.addLayers(markersToAdd);
    } else {
      markersToAdd.forEach((m) => canvasLayer.addMarker(m));
    }
  }
  if (markersToRemove.length > 0 || markersToAdd.length > 0) {
    canvasLayer.redraw();
  }

  if (canvasLayer._canvas) {
    canvasLayer._canvas.style.pointerEvents = "none";
  }
};

/**
 * 캔버스 마커에 대한 팝업을 표시합니다.
 * @param {any} marker - 마커 객체.
 * @param {any} item - 아이템 데이터.
 */
const showCanvasMarkerPopup = (marker, item) => {
  import("./popup.js").then(({ createPopupHtml }) => {
    const latlng = marker.getLatLng();
    const region = item.forceRegion || item.region || "알 수 없음";
    const popupContent = createPopupHtml(item, latlng.lat, latlng.lng, region);

    L.popup().setLatLng(latlng).setContent(popupContent).openOn(state.map);
  });
};

/**
 * 캔버스 레이어의 모든 마커를 지웁니다.
 */
export const clearCanvasLayer = () => {
  if (canvasLayer) {
    const allMarkers = Array.from(renderedMarkers.values());
    if (canvasLayer.removeLayers) {
      canvasLayer.removeLayers(allMarkers);
    } else {
      allMarkers.forEach((m) => canvasLayer.removeMarker(m, false));
    }
    canvasLayer.redraw();
    renderedMarkers.clear();

    if (state.map && state.map.hasLayer(canvasLayer)) {
      state.map.removeLayer(canvasLayer);
    }

    logger.log("Canvas", "캔버스 레이어 정리됨");
  }
};

/**
 * 캔버스 레이어가 활성화되어 있는지 확인합니다.
 * @returns {boolean} 활성화되어 있으면 true.
 */
export const isCanvasLayerActive = () => {
  return canvasLayer && state.map.hasLayer(canvasLayer);
};

/**
 * 렌더링 모드를 캔버스로 전환합니다.
 */
export const switchToCanvasMode = () => {
  if (
    state.markerClusterGroup &&
    state.map.hasLayer(state.markerClusterGroup)
  ) {
    state.map.removeLayer(state.markerClusterGroup);
  }

  if (state.allMarkers) {
    state.allMarkers.forEach((item) => {
      if (item.marker && state.map.hasLayer(item.marker)) {
        state.map.removeLayer(item.marker);
      }
    });
  }

  initCanvasLayer();
  logger.success("Canvas", "캔버스 모드로 전환 완료");
};

/**
 * 일반 렌더링 모드로 다시 전환합니다.
 */
export const switchToNormalMode = () => {
  clearCanvasLayer();
};

/**
 * 워커의 결과로부터 마커를 렌더링합니다.
 * @param {any[]} toAdd - 추가할 아이템 배열.
 * @param {any[]} toRemove - 제거할 아이템 ID 배열.
 */
export const renderFromWorker = (toAdd, toRemove) => {
  if (!canvasLayer) return;

  if (toRemove && toRemove.length > 0) {
    const markersToRemove = [];
    toRemove.forEach((id) => {
      if (renderedMarkers.has(id)) {
        markersToRemove.push(renderedMarkers.get(id));
        renderedMarkers.delete(id);
      }
    });
    if (markersToRemove.length > 0) {
      if (canvasLayer.removeLayers) {
        canvasLayer.removeLayers(markersToRemove);
      } else {
        markersToRemove.forEach((m) => canvasLayer.removeMarker(m, false));
      }
    }
  }

  if (toAdd && toAdd.length > 0) {
    const markersToAdd = [];
    const completedIds = new Set(state.completedList.map((c) => c.id));

    toAdd.forEach((item) => {
      if (renderedMarkers.has(item.id)) return;

      const iconUrl = getIconUrl(item.category);
      if (iconUrl) preloadIcon(iconUrl);

      if (!item.x || !item.y) return;
      const lat = parseFloat(item.x);
      const lng = parseFloat(item.y);
      if (isNaN(lat) || isNaN(lng)) return;

      const icon = getIconForCategory(item.category);
      const isCompleted = completedIds.has(item.id);

      const marker = L.marker([lat, lng], {
        icon: icon,
        opacity: isCompleted ? 0.4 : 1.0,
      });

      marker.itemData = item;
      markersToAdd.push(marker);
      renderedMarkers.set(item.id, marker);
    });

    if (markersToAdd.length > 0) {
      if (canvasLayer.addLayers) {
        canvasLayer.addLayers(markersToAdd);
      } else {
        markersToAdd.forEach((m) => canvasLayer.addMarker(m));
      }
    }
  }

  if ((toRemove && toRemove.length > 0) || (toAdd && toAdd.length > 0)) {
    canvasLayer.redraw();
  }
};
