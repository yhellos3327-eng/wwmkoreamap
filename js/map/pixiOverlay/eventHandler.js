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
 * Gets priority score for a sprite (higher = more important).
 * Priority: Clusters > Uncompleted markers > Completed markers
 * @param {any} sprite - The sprite to evaluate.
 * @returns {number} Priority score.
 */
const getSpritePriority = (sprite) => {
  if (!sprite.markerData) return 0;

  // Clusters have highest priority
  if (sprite.markerData.isCluster) return 100;

  // Uncompleted markers have higher priority than completed
  if (sprite.markerData.isCompleted) return 10;

  return 50; // Uncompleted marker
};

/**
 * Calculates distance from click point to sprite center.
 * @param {number} clickLat - Clicked latitude.
 * @param {number} clickLng - Clicked longitude.
 * @param {any} sprite - The sprite.
 * @returns {number} Distance in degrees.
 */
const getDistanceToSprite = (clickLat, clickLng, sprite) => {
  const dLat = clickLat - sprite.markerData.lat;
  const dLng = clickLng - sprite.markerData.lng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

/**
 * Finds a sprite at the given position with priority handling.
 * When multiple markers overlap, prioritizes: Clusters > Uncompleted > Completed
 * Among same priority, chooses the closest to click point.
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

  const candidates = [];

  const collectCandidates = (parent) => {
    if (!parent || !parent.children) return;

    for (let i = parent.children.length - 1; i >= 0; i--) {
      const child = parent.children[i];

      // Recursively search containers
      if (child instanceof PIXI.Container && child.children.length > 0 && !child.markerData) {
        collectCandidates(child);
      }

      // Check if this sprite is near the click point
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

  // Sort by priority (desc), then by distance (asc)
  candidates.sort((a, b) => {
    const priorityA = getSpritePriority(a);
    const priorityB = getSpritePriority(b);

    if (priorityA !== priorityB) {
      return priorityB - priorityA; // Higher priority first
    }

    // Same priority - choose closest to click point
    const distA = getDistanceToSprite(clickLat, clickLng, a);
    const distB = getDistanceToSprite(clickLat, clickLng, b);
    return distA - distB; // Closer first
  });

  return candidates[0];
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
        // Only return if the dev handler claims to have handled the click
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

    // First check spiderfied markers if spider is open
    const spiderfyContainer = getSpiderfyContainer();
    let sprite = null;

    if (spiderfyContainer) {
      sprite = findSpriteAtPosition(
        spiderfyContainer,
        clickLat,
        clickLng,
        hitRadiusDeg,
      );

      // If clicked outside spiderfied markers, close the spider
      if (!sprite) {
        clearSpiderfy();
        updatePixiMarkers();
        map.closePopup();
        return;
      }
    }

    // If no spiderfy or sprite found, check main container
    if (!sprite && container && container.children.length > 0) {
      sprite = findSpriteAtPosition(
        container,
        clickLat,
        clickLng,
        hitRadiusDeg,
      );
    }

    if (sprite && sprite.markerData) {
      // 1. Handle Supercluster Clusters
      if (sprite.markerData.isCluster) {
        const supercluster = getSupercluster();
        if (supercluster) {
          const clusterId = sprite.markerData.clusterId;
          const leaves = supercluster.getLeaves(clusterId, Infinity);

          // Always use spiderfy effect for clusters (no zoom-in)
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
      // No sprite found - close popup
      map.closePopup();
    }
  };

  const handleContextMenu = (e) => {
    const clickLat = e.latlng.lat;
    const clickLng = e.latlng.lng;
    const zoom = map.getZoom();
    const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

    // First, check spiderfied markers (they have higher priority)
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

    // If not found in spiderfy, check main container
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

      // Update visual state
      setTimeout(() => {
        // If this was a spiderfied marker, close the spider and refresh
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

  // DOM-level click handler to catch clicks on overlays (polygons, boundaries)
  // that don't trigger Leaflet's map click event
  const handleDomClick = (e) => {
    // Only process if spiderfy is open
    if (getSpiderfiedClusterId() === null) return;

    // Check if click is on an overlay element (canvas, svg path, etc.)
    const target = /** @type {HTMLElement} */ (e.target);
    const isOverlayClick =
      target.tagName === "CANVAS" ||
      target.tagName === "path" ||
      target.tagName === "svg" ||
      target.closest("svg") ||
      target.classList.contains("leaflet-overlay-pane") ||
      target.closest(".leaflet-overlay-pane");

    if (isOverlayClick) {
      // Convert screen coordinates to map coordinates
      const point = map.containerPointToLatLng([e.clientX - map.getContainer().getBoundingClientRect().left, e.clientY - map.getContainer().getBoundingClientRect().top]);
      const clickLat = point.lat;
      const clickLng = point.lng;
      const zoom = map.getZoom();
      const hitRadiusDeg = calculateHitRadius(clickLat, zoom);

      // Check if clicking on a spiderfied marker
      const spiderfyContainerRef = getSpiderfyContainer();
      if (spiderfyContainerRef) {
        const sprite = findSpriteAtPosition(
          spiderfyContainerRef,
          clickLat,
          clickLng,
          hitRadiusDeg,
        );

        // If not clicking on a spiderfied marker, close the spider
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

  // Add DOM-level click listener to catch overlay clicks
  map.getContainer().addEventListener("click", handleDomClick, true);

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
    domClick: null,
  };
};
