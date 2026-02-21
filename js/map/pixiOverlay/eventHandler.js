// @ts-check
/// <reference path="../../types.d.ts" />
const L = /** @type {any} */ (window).L;
const PIXI = /** @type {any} */ (window).PIXI;

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
import {
  spiderfyCluster,
  clearSpiderfy,
  getSpiderfiedClusterId,
  getSpiderfyContainer,
} from "./spiderfy.js";

let isEventHandlerAttached = false;
let registeredHandlers = {
  click: null,
  contextmenu: null,
  mousemove: null,
  mousedown: null,
  domClick: null,
};

/**
 * 위도와 줌 레벨을 기반으로 클릭 감지를 위한 히트 반경을 계산합니다.
 * @param {number} lat - 위도.
 * @param {number} zoom - 줌 레벨.
 * @returns {number} 도 단위의 히트 반경.
 */
export const calculateHitRadius = (lat, zoom) => {
  const map = state.map;
  if (map && map.options.crs === L.CRS.Simple) {
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
    const dLat = Math.abs(clickLat - spriteLat);
    const dLng = Math.abs(clickLng - spriteLng);
    return dLat <= hitRadiusDeg && dLng <= hitRadiusDeg;
  }

  const dLat = Math.abs(clickLat - spriteLat);
  const dLng =
    Math.abs(clickLng - spriteLng) * Math.cos((clickLat * Math.PI) / 180);

  return dLat <= hitRadiusDeg && dLng <= hitRadiusDeg;
};

/**
 * 스프라이트의 우선순위 점수를 계산합니다 (높을수록 중요).
 * 우선순위: 클러스터 > 미완료 마커 > 완료 마커
 * @param {any} sprite - 평가할 스프라이트.
 * @returns {number} 우선순위 점수.
 */
const getSpritePriority = (sprite) => {
  if (!sprite.markerData) return 0;

  if (sprite.markerData.isCluster) return 100;

  if (sprite.markerData.isCompleted) return 10;

  return 50;
};

/**
 * 클릭 지점에서 스프라이트 중심까지의 거리를 계산합니다.
 * @param {number} clickLat - 클릭된 위도.
 * @param {number} clickLng - 클릭된 경도.
 * @param {any} sprite - 스프라이트.
 * @returns {number} 도 단위의 거리.
 */
const getDistanceToSprite = (clickLat, clickLng, sprite) => {
  const dLat = clickLat - sprite.markerData.lat;
  const dLng = clickLng - sprite.markerData.lng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

/**
 * 주어진 위치에서 우선순위 처리가 적용된 스프라이트를 찾습니다.
 * 여러 마커가 겹칠 경우 우선순위: 클러스터 > 미완료 > 완료
 * 동일 우선순위 내에서는 클릭 지점과 가장 가까운 것을 선택합니다.
 * @param {any} container - PIXI 컨테이너.
 * @param {number} clickLat - 클릭된 위도.
 * @param {number} clickLng - 클릭된 경도.
 * @param {number} hitRadiusDeg - 도 단위의 히트 반경.
 * @returns {any|null} 찾은 스프라이트 또는 null.
 */
export const findSpriteAtPosition = (
  container,
  clickLat,
  clickLng,
  hitRadiusDeg,
) => {
  if (!container) return null;

  const candidates = [];

  const collectCandidates = (parent) => {
    if (!parent || !parent.children) return;

    for (let i = parent.children.length - 1; i >= 0; i--) {
      const child = parent.children[i];

      if (child instanceof PIXI.Container && child.children.length > 0 && !child.markerData) {
        collectCandidates(child);
      }

      if (
        child.markerData &&
        isPointNearSprite(clickLat, clickLng, child, hitRadiusDeg)
      ) {
        candidates.push(child);
      }
    }
  };

  collectCandidates(container);

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  candidates.sort((a, b) => {
    const priorityA = getSpritePriority(a);
    const priorityB = getSpritePriority(b);

    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    const distA = getDistanceToSprite(clickLat, clickLng, a);
    const distB = getDistanceToSprite(clickLat, clickLng, b);
    return distA - distB;
  });

  return candidates[0];
};

/**
 * 지도에 이벤트 핸들러를 연결합니다.
 * @param {L.Map} map - Leaflet 지도 인스턴스.
 * @param {any} overlay - PixiOverlay 인스턴스.
 * @param {any} container - PIXI 컨테이너.
 */
export const attachEventHandlers = (map, overlay, container) => {
  if (isEventHandlerAttached) {
    console.log("%c[GPU Events] Already attached, skipping", "color: #FFA500;");
    return;
  }

  const handleClick = (e) => {
    if (
      state.isDevMode &&
      /** @type {any} */ (window).dev &&
      /** @type {any} */ (window).dev.handleGpuClick
    ) {
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
        if (/** @type {any} */ (window).dev.handleGpuClick(sprite.markerData.item.id)) {
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          return;
        }
      }
    }

    const clickLat = e.latlng.lat;
    const clickLng = e.latlng.lng;
    const zoom = map.getZoom();
    const hitRadiusDeg = calculateHitRadius(clickLat, zoom);
    const spiderfyContainer = getSpiderfyContainer();
    let sprite = null;

    if (spiderfyContainer) {
      sprite = findSpriteAtPosition(
        spiderfyContainer,
        clickLat,
        clickLng,
        hitRadiusDeg,
      );

      if (!sprite) {
        clearSpiderfy();
        updatePixiMarkers();
        map.closePopup();
        return;
      }
    }

    if (!sprite && container && container.children.length > 0) {
      sprite = findSpriteAtPosition(
        container,
        clickLat,
        clickLng,
        hitRadiusDeg,
      );
    }

    if (sprite && sprite.markerData) {
      if (sprite.markerData.isCluster) {
        const supercluster = getSupercluster();
        if (supercluster) {
          const clusterId = sprite.markerData.clusterId;
          const leaves = supercluster.getLeaves(clusterId, Infinity);

          const utils = getPixiUtils();
          const mainContainer = getPixiContainer();

          if (utils && mainContainer && leaves.length > 0) {
            spiderfyCluster(
              clusterId,
              [sprite.markerData.lat, sprite.markerData.lng],
              leaves,
              mainContainer,
              utils,
            );

            map.panTo([sprite.markerData.lat, sprite.markerData.lng]);
          }
        }
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
        }
        return;
      }

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
    const clickLat = e.latlng.lat;
    const clickLng = e.latlng.lng;
    const zoom = map.getZoom();
    const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

    const spiderfyContainer = getSpiderfyContainer();

    let sprite = null;

    if (spiderfyContainer) {
      sprite = findSpriteAtPosition(
        spiderfyContainer,
        clickLat,
        clickLng,
        hitRadiusDeg,
      );
    }

    if (!sprite && container && container.children.length > 0) {
      sprite = findSpriteAtPosition(
        container,
        clickLat,
        clickLng,
        hitRadiusDeg,
      );
    }

    if (sprite && sprite.markerData && sprite.markerData.item) {
      if (e.originalEvent) {
        L.DomEvent.preventDefault(e.originalEvent);
        L.DomEvent.stopPropagation(e.originalEvent);
      }

      toggleCompleted(sprite.markerData.item.id);

      setTimeout(() => {
        if (sprite.markerData.isSpiderfied) {
          clearSpiderfy();
        }
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

  const handleDomClick = (e) => {
    if (getSpiderfiedClusterId() === null) return;

    const target = /** @type {HTMLElement} */ (e.target);
    const isOverlayClick =
      target.tagName === "CANVAS" ||
      target.tagName === "path" ||
      target.tagName === "svg" ||
      target.closest("svg") ||
      target.classList.contains("leaflet-overlay-pane") ||
      target.closest(".leaflet-overlay-pane");

    if (isOverlayClick) {
      const point = map.containerPointToLatLng([e.clientX - map.getContainer().getBoundingClientRect().left, e.clientY - map.getContainer().getBoundingClientRect().top]);
      const clickLat = point.lat;
      const clickLng = point.lng;
      const zoom = map.getZoom();
      const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

      const spiderfyContainerRef = getSpiderfyContainer();
      if (spiderfyContainerRef) {
        const sprite = findSpriteAtPosition(
          spiderfyContainerRef,
          clickLat,
          clickLng,
          hitRadiusDeg,
        );

        if (!sprite) {
          clearSpiderfy();
          updatePixiMarkers();
          map.closePopup();
        }
      }
    }
  };

  registeredHandlers.click = handleClick;
  registeredHandlers.contextmenu = handleContextMenu;
  registeredHandlers.mousemove = handleMouseMove;
  registeredHandlers.mousedown = handleMouseDown;
  registeredHandlers.domClick = handleDomClick;

  map.on("click", handleClick);
  map.on("contextmenu", handleContextMenu);
  map.on("mousemove", handleMouseMove);
  map.on("mousedown", handleMouseDown);

  map.getContainer().addEventListener("click", handleDomClick, true);

  isEventHandlerAttached = true;
  console.log("%c[GPU Events] ✓ Event handlers attached", "color: #4CAF50;");
};

/**
 * 지도에서 이벤트 핸들러를 제거합니다.
 * @param {L.Map} map - Leaflet 지도 인스턴스.
 */
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
  if (registeredHandlers.domClick) {
    map.getContainer().removeEventListener("click", registeredHandlers.domClick, true);
  }

  registeredHandlers = {
    click: null,
    contextmenu: null,
    mousemove: null,
    mousedown: null,
    domClick: null,
  };
  isEventHandlerAttached = false;

  console.log("%c[GPU Events] ✓ Event handlers detached", "color: #FFA500;");
};

/**
 * 이벤트 핸들러가 연결되어 있는지 확인합니다.
 * @returns {boolean} 연결되어 있으면 true.
 */
export const isEventHandlersAttached = () => isEventHandlerAttached;

/**
 * 이벤트 핸들러 상태를 초기화합니다.
 */
export const resetEventHandlers = () => {
  isEventHandlerAttached = false;
  registeredHandlers = {
    click: null,
    contextmenu: null,
    mousemove: null,
    mousedown: null,
    domClick: null,
  };
};
