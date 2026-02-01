// @ts-check
/// <reference path="../types.d.ts" />
const L = /** @type {any} */ (window).L;
import { MAP_CONFIGS } from "../config.js";
import { state, setState } from "../state.js";
import { toggleSidebar } from "../ui.js";
import { updateMapVisibility } from "./visibility.js";

/**
 * Initializes the map for a given map key.
 * @param {string} mapKey - The map key.
 * @returns {Promise<void>}
 */
export const initMap = async (mapKey) => {
  const config = MAP_CONFIGS[mapKey];
  if (!config) return;

  const targetCRS = config.crs === "Simple" ? L.CRS.Simple : L.CRS.EPSG3857;

  if (state.map && state.map.options.crs !== targetCRS) {
    const pixi = await import("./pixiOverlay.js");
    if (pixi.disposePixiOverlay) await pixi.disposePixiOverlay();
    if (pixi.resetEventHandlers) pixi.resetEventHandlers();

    state.map.remove();
    setState("map", null);
    setState("regionLayerGroup", null);
    setState("markerClusterGroup", null);
    setState("currentTileLayer", null);
  }

  if (!state.map) {
    const isMobile = window.innerWidth <= 768;
    const initialZoom = isMobile ? config.zoom - 1 : config.zoom;

    const map = L.map("map", {
      crs: targetCRS,
      center: config.center,
      zoom: initialZoom,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      zoomControl: false,
      attributionControl: false,
      maxBoundsViscosity: 1.0,
      preferCanvas: true,
      markerZoomAnimation: false,
    });
    setState("map", map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    map.on("zoomend", () => {
      const zoom = map.getZoom();
      const mapContainer = map.getContainer();

      if (zoom < 4) {
        mapContainer.classList.add("low-quality-mode");
      } else {
        mapContainer.classList.remove("low-quality-mode");
      }

      import("./regions.js").then(({ updateRegionOverlay }) =>
        updateRegionOverlay(),
      );
    });

    map.on("movestart", () => {
      setState("isDragging", true);
    });

    map.on("moveend", () => {
      setState("isDragging", false);

      import("./regions.js").then(({ updateRegionOverlay }) =>
        updateRegionOverlay(),
      );
    });

    map.on("click", () => {
      if (window.innerWidth <= 768) toggleSidebar("close");
    });

    // Middle click (auxclick) handler for adding markers
    const mapContainer = map.getContainer();
    mapContainer.addEventListener("auxclick", (e) => {
      // Button 1 is middle mouse button (wheel click)
      // Only allow if Community Mode is active
      if (!state.showCommunityMarkers) return;

      console.log("Auxclick detected:", e.button);
      if (e.button === 1) {
        e.preventDefault();
        console.log("Middle click confirmed. Importing dev-tools...");
        import("../dev-tools.js").then(({ openAddMarkerModal }) => {
          console.log("dev-tools imported. Opening modal...");
          const latlng = map.mouseEventToLatLng(e);
          openAddMarkerModal(latlng.lat, latlng.lng);
        }).catch(err => console.error("Failed to import dev-tools:", err));
      }
    });
  } else {
    state.map.setView(config.center, config.zoom);
    if (config.minZoom !== undefined) state.map.setMinZoom(config.minZoom);
    if (config.maxZoom !== undefined) state.map.setMaxZoom(config.maxZoom);
  }

  if (state.currentTileLayer) {
    state.map.removeLayer(state.currentTileLayer);
  }

  let tileLayer;
  if (config.type === "image") {
    tileLayer = L.imageOverlay(config.imageUrl, config.bounds).addTo(state.map);
  } else {
    tileLayer = L.tileLayer(config.tileUrl, {
      tms: false,
      noWrap: true,
      tileSize: 256,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      maxNativeZoom: config.maxNativeZoom || config.maxZoom,
    }).addTo(state.map);
  }

  setState("currentTileLayer", tileLayer);

  // Remove skeleton loading state from map
  const mapEl = document.getElementById("map");
  if (mapEl) mapEl.classList.remove("skeleton-loading");

  if (state.regionLayerGroup) {
    state.regionLayerGroup.clearLayers();
  } else {
    const regionLayerGroup = L.layerGroup().addTo(state.map);
    setState("regionLayerGroup", regionLayerGroup);
  }

  if (!state.markerClusterGroup) {
    const isMobile = window.innerWidth <= 768;
    const markerClusterGroup = L.markerClusterGroup({
      maxClusterRadius: isMobile ? 40 : 30,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      disableClusteringAtZoom: 14,
      spiderfyDistanceMultiplier: 2,
      chunkedLoading: true,
    });

    markerClusterGroup.on("clusterclick", function (a) {
      a.layer.spiderfy();
    });
    setState("markerClusterGroup", markerClusterGroup);
  }
};
