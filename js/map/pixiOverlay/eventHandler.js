import { state } from "../../state.js";
import { toggleCompleted } from "../../ui.js";
import { showPopupForSprite } from "./spriteFactory.js";
import {
  showCompletedTooltip,
  hideCompletedTooltip,
} from "../completedTooltip.js";
import {
  updatePixiMarkers,
  getSupercluster,
  getPixiUtils,
  getPixiContainer,
} from "./overlayCore.js";
import { logMarkerDebugInfo } from "../markerDebug.js";
import { spiderfyCluster } from "./spiderfy.js";

let isEventHandlerAttached = false;
let registeredHandlers = {
  click: null,
  contextmenu: null,
  mousemove: null,
  mousedown: null,
};

export const calculateHitRadius = (lat, zoom) => {
  const map = state.map;
  if (map && map.options.crs === L.CRS.Simple) {
    // Simple CRS (이미지 맵): 줌 레벨에 따라 픽셀 단위로 계산
    // 줌 0에서 1단위가 1픽셀. 화면상 22픽셀 반경을 원함.
    return 22 / Math.pow(2, zoom);
  }

  const metersPerPixel =
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
  const hitRadiusMeters = 22 * metersPerPixel;
  return hitRadiusMeters / 111000;
};

const isPointNearSprite = (clickLat, clickLng, sprite, hitRadiusDeg) => {
  const spriteLat = sprite.markerData.lat;
  const spriteLng = sprite.markerData.lng;

  const map = state.map;
  if (map && map.options.crs === L.CRS.Simple) {
    // Simple CRS: 단순 유클리드 거리 (또는 사각형 범위)
    const dLat = Math.abs(clickLat - spriteLat);
    const dLng = Math.abs(clickLng - spriteLng);
    return dLat <= hitRadiusDeg && dLng <= hitRadiusDeg;
  }

  const dLat = Math.abs(clickLat - spriteLat);
  const dLng =
    Math.abs(clickLng - spriteLng) * Math.cos((clickLat * Math.PI) / 180);

  return dLat <= hitRadiusDeg && dLng <= hitRadiusDeg;
};

export const findSpriteAtPosition = (
  container,
  clickLat,
  clickLng,
  hitRadiusDeg,
) => {
  if (!container) return null;

  const searchRecursive = (parent) => {
    if (!parent || !parent.children) return null;
    for (let i = parent.children.length - 1; i >= 0; i--) {
      const child = parent.children[i];
      if (child instanceof PIXI.Container && child.children.length > 0) {
        const found = searchRecursive(child);
        if (found) return found;
      }

      if (
        child.markerData &&
        isPointNearSprite(clickLat, clickLng, child, hitRadiusDeg)
      ) {
        return child;
      }
    }
    return null;
  };

  return searchRecursive(container);
};

export const attachEventHandlers = (map, overlay, container) => {
  if (isEventHandlerAttached) {
    console.log("%c[GPU Events] Already attached, skipping", "color: #FFA500;");
    return;
  }

  const handleClick = (e) => {
    // 개발자 도구 모드 처리
    if (state.isDevMode && window.dev && window.dev.handleGpuClick) {
      const clickLat = e.latlng.lat;
      const clickLng = e.latlng.lng;
      const zoom = map.getZoom();
      const hitRadiusDeg = calculateHitRadius(clickLat, zoom);
      const sprite = findSpriteAtPosition(
        container,
        clickLat,
        clickLng,
        hitRadiusDeg,
      );

      if (sprite) {
        window.dev.handleGpuClick(sprite.markerData.item.id);
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
        }
        return;
      }
    }

    if (!container || container.children.length === 0) return;

    const clickLat = e.latlng.lat;
    const clickLng = e.latlng.lng;
    const zoom = map.getZoom();
    const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

    const sprite = findSpriteAtPosition(
      container,
      clickLat,
      clickLng,
      hitRadiusDeg,
    );

    if (sprite && sprite.markerData) {
      // 클러스터 클릭 처리
      if (sprite.markerData.isCluster) {
        const supercluster = getSupercluster();
        if (supercluster) {
          const clusterId = sprite.markerData.clusterId;
          const expansionZoom = supercluster.getClusterExpansionZoom(clusterId);

          // Spiderfy 조건 체크
          const leaves = supercluster.getLeaves(clusterId, Infinity);

          // 위치 동일 여부 확인
          let allSamePosition = true;
          if (leaves.length > 0) {
            const firstGeom = leaves[0].geometry.coordinates;
            for (let i = 1; i < leaves.length; i++) {
              const geom = leaves[i].geometry.coordinates;
              if (geom[0] !== firstGeom[0] || geom[1] !== firstGeom[1]) {
                allSamePosition = false;
                break;
              }
            }
          }

          // 줌 레벨이 최대치이거나 더 이상 확대할 수 없을 때 펼치기
          const maxZoom = map.getMaxZoom();
          if (
            Number.isNaN(expansionZoom) ||
            expansionZoom > maxZoom ||
            allSamePosition
          ) {
            // Spiderfy 실행
            const utils = getPixiUtils();
            const mainContainer = getPixiContainer(); // 메인 컨테이너

            if (utils && mainContainer) {
              spiderfyCluster(
                clusterId,
                [sprite.markerData.lat, sprite.markerData.lng],
                leaves,
                mainContainer,
                utils,
              );

              // 지도가 중심을 잡도록 이동
              map.panTo([sprite.markerData.lat, sprite.markerData.lng]);
            }
          } else {
            // 일반 확대
            map.flyTo(
              [sprite.markerData.lat, sprite.markerData.lng],
              expansionZoom,
            );
          }
        }
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
        }
        return;
      }

      // 일반 마커 (또는 Spiderfied 마커) 클릭 처리
      hideCompletedTooltip();
      if (e.originalEvent) {
        e.originalEvent.stopPropagation();
      }

      const itemId = sprite.markerData.item.id;
      const currentPopup = map._popup;

      logMarkerDebugInfo(
        sprite.markerData.item,
        sprite.markerData.item.category,
        sprite.markerData.region,
        sprite.markerData.lat,
        sprite.markerData.lng,
      );

      if (
        currentPopup &&
        currentPopup.itemId === itemId &&
        map.hasLayer(currentPopup)
      ) {
        map.closePopup();
      } else {
        showPopupForSprite(sprite);
      }
    } else {
      map.closePopup();
    }
  };

  const handleContextMenu = (e) => {
    if (!container || container.children.length === 0) return;

    const clickLat = e.latlng.lat;
    const clickLng = e.latlng.lng;
    const zoom = map.getZoom();
    const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

    const sprite = findSpriteAtPosition(
      container,
      clickLat,
      clickLng,
      hitRadiusDeg,
    );

    if (sprite) {
      if (e.originalEvent) {
        L.DomEvent.preventDefault(e.originalEvent);
        L.DomEvent.stopPropagation(e.originalEvent);
      }

      toggleCompleted(sprite.markerData.item.id);

      setTimeout(() => {
        updatePixiMarkers();
      }, 50);
    }
  };

  const handleMouseMove = (e) => {
    if (!container || container.children.length === 0) {
      hideCompletedTooltip();
      return;
    }

    const clickLat = e.latlng.lat;
    const clickLng = e.latlng.lng;
    const zoom = map.getZoom();
    const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

    // 재귀 탐색 필요 (Spiderfy 마커 툴팁 지원)
    const sprite = findSpriteAtPosition(
      container,
      clickLat,
      clickLng,
      hitRadiusDeg,
    );

    if (sprite && sprite.markerData && sprite.markerData.isCompleted) {
      const currentPopup = map._popup;
      if (
        currentPopup &&
        currentPopup.itemId === sprite.markerData.item.id &&
        map.hasLayer(currentPopup)
      ) {
        hideCompletedTooltip();
        return;
      }

      showCompletedTooltip(
        { latlng: L.latLng(sprite.markerData.lat, sprite.markerData.lng) },
        sprite.markerData.item.id,
        sprite.markerData.item.name,
        sprite.markerData.completedAt,
      );
      return;
    }

    hideCompletedTooltip();
  };

  const handleMouseDown = (e) => {
    if (!container || container.children.length === 0) return;

    // Check for middle click (button 1)
    if (e.originalEvent.button !== 1) return;

    const clickLat = e.latlng.lat;
    const clickLng = e.latlng.lng;
    const zoom = map.getZoom();
    const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

    const sprite = findSpriteAtPosition(
      container,
      clickLat,
      clickLng,
      hitRadiusDeg,
    );

    if (sprite) {
      if (e.originalEvent) {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
      }

      const item = sprite.markerData.item;
      const catId = item.category;
      const itemId = item.id;
      const textToCopy = `Override,"${catId}","${itemId}"`;

      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          console.log("Copied to clipboard (GPU):", textToCopy);
        })
        .catch((err) => {
          console.error("Failed to copy (GPU):", err);
        });
    }
  };

  registeredHandlers.click = handleClick;
  registeredHandlers.contextmenu = handleContextMenu;
  registeredHandlers.mousemove = handleMouseMove;
  registeredHandlers.mousedown = handleMouseDown;

  map.on("click", handleClick);
  map.on("contextmenu", handleContextMenu);
  map.on("mousemove", handleMouseMove);
  map.on("mousedown", handleMouseDown);

  isEventHandlerAttached = true;
  console.log("%c[GPU Events] ✓ Event handlers attached", "color: #4CAF50;");
};

export const detachEventHandlers = (map) => {
  if (!isEventHandlerAttached || !map) return;

  if (registeredHandlers.click) {
    map.off("click", registeredHandlers.click);
  }
  if (registeredHandlers.contextmenu) {
    map.off("contextmenu", registeredHandlers.contextmenu);
  }
  if (registeredHandlers.mousemove) {
    map.off("mousemove", registeredHandlers.mousemove);
  }
  if (registeredHandlers.mousedown) {
    map.off("mousedown", registeredHandlers.mousedown);
  }

  registeredHandlers = {
    click: null,
    contextmenu: null,
    mousemove: null,
    mousedown: null,
  };
  isEventHandlerAttached = false;

  console.log("%c[GPU Events] ✓ Event handlers detached", "color: #FFA500;");
};

export const isEventHandlersAttached = () => isEventHandlerAttached;

export const resetEventHandlers = () => {
  isEventHandlerAttached = false;
  registeredHandlers = {
    click: null,
    contextmenu: null,
    mousemove: null,
    mousedown: null,
  };
};
