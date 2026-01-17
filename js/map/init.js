import { MAP_CONFIGS } from "../config.js";
import { state, setState } from "../state.js";
import { toggleSidebar } from "../ui.js";
import { updateMapVisibility } from "./visibility.js";

export const initMap = async (mapKey) => {
  const config = MAP_CONFIGS[mapKey];
  if (!config) return;

  const targetCRS = config.crs === "Simple" ? L.CRS.Simple : L.CRS.EPSG3857;

  if (state.map && state.map.options.crs !== targetCRS) {
    // GPU 모드 관련 리소스 정리
    const pixi = await import("./pixiOverlay.js");
    if (pixi.disposePixiOverlay) pixi.disposePixiOverlay();
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

      // GPU 모드에서는 PixiOverlay가 줌/팬을 자동으로 처리하므로 별도 로직 불필요
      // 단, 클러스터링이나 오버레이 업데이트 등은 필요할 수 있음

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
  } else {
    state.map.setView(config.center, config.zoom);
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
