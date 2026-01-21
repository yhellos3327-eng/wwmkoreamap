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
import { spiderfyCluster } from "./spiderfy.js";

let isEventHandlerAttached = false;
let registeredHandlers = {
  click: null,
  contextmenu: null,
  mousemove: null,
  mousedown: null,
};

/**
 * Calculates the hit radius for click detection based on latitude and zoom.
 * @param {number} lat - The latitude.
 * @param {number} zoom - The zoom level.
 * @returns {number} The hit radius in degrees.
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
 * Finds a sprite at the given position.
 * @param {any} container - The PIXI container.
 * @param {number} clickLat - The clicked latitude.
 * @param {number} clickLng - The clicked longitude.
 * @param {number} hitRadiusDeg - The hit radius in degrees.
 * @returns {any|null} The found sprite or null.
 */
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

/**
 * Attaches event handlers to the map.
 * @param {L.Map} map - The Leaflet map instance.
 * @param {any} overlay - The PixiOverlay instance.
 * @param {any} container - The PIXI container.
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
        /** @type {any} */ (window).dev.handleGpuClick(
          sprite.markerData.item.id,
        );
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
      if (sprite.markerData.isCluster) {
        const supercluster = getSupercluster();
        if (supercluster) {
          const clusterId = sprite.markerData.clusterId;
          const expansionZoom = supercluster.getClusterExpansionZoom(clusterId);

          const leaves = supercluster.getLeaves(clusterId, Infinity);

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

          const maxZoom = map.getMaxZoom();
          if (
            Number.isNaN(expansionZoom) ||
            expansionZoom > maxZoom ||
            allSamePosition
          ) {
            const utils = getPixiUtils();
            const mainContainer = getPixiContainer();

            if (utils && mainContainer) {
              spiderfyCluster(
                clusterId,
                [sprite.markerData.lat, sprite.markerData.lng],
                leaves,
                mainContainer,
                utils,
              );

              map.panTo([sprite.markerData.lat, sprite.markerData.lng]);
            }
          } else {
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

/**
 * Detaches event handlers from the map.
 * @param {L.Map} map - The Leaflet map instance.
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

  registeredHandlers = {
    click: null,
    contextmenu: null,
    mousemove: null,
    mousedown: null,
  };
  isEventHandlerAttached = false;

  console.log("%c[GPU Events] ✓ Event handlers detached", "color: #FFA500;");
};

/**
 * Checks if event handlers are attached.
 * @returns {boolean} True if attached.
 */
export const isEventHandlersAttached = () => isEventHandlerAttached;

/**
 * Resets the event handler state.
 */
export const resetEventHandlers = () => {
  isEventHandlerAttached = false;
  registeredHandlers = {
    click: null,
    contextmenu: null,
    mousemove: null,
    mousedown: null,
  };
};
