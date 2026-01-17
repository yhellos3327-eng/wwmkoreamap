import { state, setState } from "../../state.js";
import { logger } from "../../logger.js";
import { ICON_SIZE } from "./config.js";
import { preloadTextures, clearTextureCache } from "./textureManager.js";
import {
  createSpriteForItem,
  clearSpriteDataMap,
  addSpriteToDataMap,
} from "./spriteFactory.js";
import { showRenderModeIndicator } from "./renderModeIndicator.js";
import { attachEventHandlers, detachEventHandlers } from "./eventHandler.js";
import {
  clearSpiderfy,
  getSpiderfiedClusterId,
  getSpiderfyContainer,
  updateSpiderfyPositions,
} from "./spiderfy.js";

let pixiOverlay = null;
let pixiContainer = null;
let isInitialized = false;
let firstDraw = true;
let prevZoom = null;
let supercluster = null;
let pixiUtils = null;

export const getSupercluster = () => supercluster;
export const getPixiUtils = () => pixiUtils;
export const getPixiContainer = () => pixiContainer;

export const isGpuRenderingAvailable = () => {
  const hasPixi =
    typeof window.PIXI !== "undefined" && typeof L.pixiOverlay !== "undefined";

  // Check WebGL support
  let hasWebGL = false;
  try {
    const canvas = document.createElement("canvas");
    hasWebGL = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    hasWebGL = false;
  }

  const available = hasPixi && hasWebGL;
  return available;
};

export const getPixiOverlay = () => pixiOverlay;

export const initPixiOverlay = async () => {
  if (!isGpuRenderingAvailable()) {
    logger.warn("PixiOverlay", "PIXI or L.pixiOverlay not available");
    return null;
  }

  if (isInitialized && pixiOverlay) {
    return pixiOverlay;
  }

  pixiContainer = new PIXI.Container();
  pixiContainer.sortableChildren = true;

  pixiOverlay = L.pixiOverlay(
    (utils) => {
      pixiUtils = utils; // utils 저장
      const zoom = utils.getMap().getZoom();
      const container = utils.getContainer();
      const renderer = utils.getRenderer();
      const project = utils.latLngToLayerPoint;
      const scale = utils.getScale();
      const map = utils.getMap();

      // 줌 레벨이 변경되었을 때 Spiderfy 해제
      // 줌 레벨이 변경되었을 때 Spiderfy 해제
      if (prevZoom !== null && prevZoom !== zoom) {
        clearSpiderfy();
      } else {
        updateSpiderfyPositions(utils);
      }

      // 클러스터링 활성화 여부 확인
      const isSimpleCRS = map.options.crs === L.CRS.Simple;
      if (state.enableClustering && supercluster && !isSimpleCRS) {
        // 1. 클러스터링 모드: 매 프레임 다시 그리기 (동적 구성)
        pixiContainer.removeChildren();
        clearSpriteDataMap();

        const bounds = map.getBounds();
        const bbox = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ];

        // 화면보다 조금 더 넓게 검색 (패딩)
        const padding = 0.1; // 10%
        const width = bbox[2] - bbox[0];
        const height = bbox[3] - bbox[1];
        bbox[0] -= width * padding;
        bbox[1] -= height * padding;
        bbox[2] += width * padding;
        bbox[3] += height * padding;

        const clusters = supercluster.getClusters(bbox, Math.floor(zoom));
        const spiderfiedClusterId = getSpiderfiedClusterId();

        clusters.forEach((cluster) => {
          // Spiderfy된 클러스터는 그리지 않음 (펼쳐진 상태로 표시해야 하므로)
          if (cluster.id === spiderfiedClusterId) {
            return;
          }

          const [lng, lat] = cluster.geometry.coordinates;
          const coords = project([lat, lng]);

          if (cluster.properties.cluster) {
            // 클러스터 렌더링
            const count = cluster.properties.point_count;
            const clusterId = cluster.id;

            // 클러스터 그래픽 생성 (원)
            const graphics = new PIXI.Graphics();
            let color = 0x66bb6a; // 기본 녹색
            let radius = 20;

            if (count > 100) {
              color = 0xffca28;
              radius = 30;
            } // 노랑
            if (count > 1000) {
              color = 0xef5350;
              radius = 40;
            } // 빨강

            graphics.beginFill(color, 0.8);
            graphics.lineStyle(2, 0xffffff, 1);
            graphics.drawCircle(0, 0, radius);
            graphics.endFill();
            graphics.x = coords.x;
            graphics.y = coords.y;

            // 텍스트 생성
            const text = new PIXI.Text(count.toString(), {
              fontFamily: "Arial",
              fontSize: 14,
              fill: 0xffffff,
              align: "center",
              fontWeight: "bold",
            });
            text.anchor.set(0.5);
            graphics.addChild(text);

            // 인터랙션 데이터 설정
            graphics.interactive = true;
            graphics.buttonMode = true;
            graphics.markerData = {
              isCluster: true,
              clusterId: clusterId,
              point_count: count,
              lat: lat,
              lng: lng,
            };

            // 스케일 역보정 (지도가 확대/축소되어도 크기 유지)
            graphics.scale.set(1 / scale);

            pixiContainer.addChild(graphics);
          } else {
            // 개별 마커 렌더링
            // 원본 아이템 데이터 복원
            const item = cluster.properties.item; // supercluster 로드 시 properties에 item 저장해야 함
            if (item) {
              const sprite = createSpriteForItem(item);
              if (sprite) {
                sprite.x = coords.x;
                sprite.y = coords.y;

                const targetSize = ICON_SIZE / scale;
                sprite.width = targetSize;
                sprite.height = targetSize;

                // 필터 초기화
                if (sprite.filters === undefined || sprite.filters === null) {
                  sprite.filters = [];
                }

                pixiContainer.addChild(sprite);
                addSpriteToDataMap(sprite, item);
              }
            }
          }
        });

        // Spiderfy 컨테이너가 있다면 다시 추가 (removeChildren으로 삭제되었으므로)
        const spiderfyContainer = getSpiderfyContainer();
        if (spiderfyContainer) {
          pixiContainer.addChild(spiderfyContainer);
        }
      } else {
        // 2. 비클러스터링 모드 (기존 로직): 위치만 업데이트
        pixiContainer.children.forEach((sprite) => {
          if (sprite.markerData && !sprite.markerData.isCluster) {
            const coords = project([
              sprite.markerData.lat,
              sprite.markerData.lng,
            ]);
            sprite.x = coords.x;
            sprite.y = coords.y;

            const targetSize = ICON_SIZE / scale;
            sprite.width = targetSize;
            sprite.height = targetSize;

            if (sprite.filters === undefined || sprite.filters === null) {
              sprite.filters = [];
            }
          }
        });
      }

      firstDraw = false;
      prevZoom = zoom;
      renderer.render(pixiContainer);
    },
    pixiContainer,
    {
      autoPreventDefault: false,
      doubleBuffering: true,
      destroyInteractionManager: false,
      pane: "markerPane",
    },
  );

  setState("pixiOverlay", pixiOverlay);
  setState("pixiContainer", pixiContainer);
  isInitialized = true;

  console.log(
    "%c╔══════════════════════════════════════════════════════════╗",
    "color: #4CAF50; font-weight: bold;",
  );
  console.log(
    "%c║  🚀 GPU MODE ACTIVATED - PixiOverlay Initialized        ║",
    "color: #4CAF50; font-weight: bold; font-size: 14px;",
  );
  console.log(
    "%c║  Renderer: WebGL (Hardware Accelerated)                  ║",
    "color: #4CAF50;",
  );
  console.log(
    "%c║  PIXI Version: " + (PIXI.VERSION || "unknown").padEnd(41) + " ║",
    "color: #4CAF50;",
  );
  console.log(
    "%c╚══════════════════════════════════════════════════════════╝",
    "color: #4CAF50; font-weight: bold;",
  );

  logger.success("PixiOverlay", "GPU overlay initialized");
  return pixiOverlay;
};

export const renderMarkersWithPixi = async (items) => {
  if (!isGpuRenderingAvailable()) {
    logger.warn(
      "PixiOverlay",
      "GPU rendering not available, falling back to CPU mode (setting preserved)",
    );
    return;
  }

  if (!pixiOverlay) {
    await initPixiOverlay();
  }

  if (!pixiOverlay || !pixiContainer) {
    logger.error("PixiOverlay", "Failed to initialize PixiOverlay");
    return;
  }

  await preloadTextures(items);

  // Supercluster 초기화 및 데이터 로드
  if (typeof Supercluster !== "undefined") {
    supercluster = new Supercluster({
      radius: 60,
      maxZoom: 16,
      minPoints: 2,
    });

    const points = items.map((item) => ({
      type: "Feature",
      properties: { cluster: false, item: item }, // item 데이터 포함
      geometry: {
        type: "Point",
        coordinates: [parseFloat(item.y), parseFloat(item.x)], // [lng, lat]
      },
    }));

    supercluster.load(points);
    console.log(
      `[PixiOverlay] Supercluster loaded with ${points.length} points`,
    );
  } else {
    console.warn("[PixiOverlay] Supercluster library not found");
  }

  // 초기 렌더링
  const isSimpleCRS = state.map && state.map.options.crs === L.CRS.Simple;
  if (state.enableClustering && !isSimpleCRS) {
    // 클러스터링 모드면 drawCallback에서 처리하므로 여기선 redraw만 호출
    pixiOverlay.redraw();
  } else {
    // 비클러스터링 모드면 전체 마커 추가
    pixiContainer.removeChildren();
    clearSpriteDataMap();
    state.allMarkers = new Map();

    let addedCount = 0;
    let skippedCount = 0;
    for (const item of items) {
      const sprite = createSpriteForItem(item);
      if (sprite) {
        pixiContainer.addChild(sprite);
        addSpriteToDataMap(sprite, item);

        const markerInfo = {
          id: item.id,
          sprite: sprite,
          name: item.name,
          category: item.category,
          region: sprite.markerData.region,
          lat: sprite.markerData.lat,
          lng: sprite.markerData.lng,
        };
        state.allMarkers.set(item.id, markerInfo);

        addedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(
      `[GPU Render] ${addedCount} markers rendered, ${skippedCount} markers skipped (filtered).`,
    );
    logger.success("PixiOverlay", `Rendered ${addedCount} markers with GPU`);
  }

  if (state.map && !state.map.hasLayer(pixiOverlay)) {
    pixiOverlay.addTo(state.map);

    if (state.map.options) {
      state.map.options.closePopupOnClick = false;
    }

    attachEventHandlers(state.map, pixiOverlay, pixiContainer);
  }

  pixiOverlay.redraw();
  showRenderModeIndicator("GPU");
};

export const updatePixiMarkers = async () => {
  if (!state.gpuRenderMode || !isGpuRenderingAvailable()) return;

  const items = state.mapData?.items || [];
  await renderMarkersWithPixi(items);
};

export const updateSinglePixiMarker = (itemId) => {
  if (!state.gpuRenderMode || !pixiContainer) return;

  const sprite = pixiContainer.children.find(
    (s) => s.markerData && String(s.markerData.item.id) === String(itemId),
  );

  if (sprite) {
    const completedItem = state.completedList.find(
      (c) => String(c.id) === String(itemId),
    );
    const isCompleted = !!completedItem;

    sprite.alpha = isCompleted ? 0.4 : 1.0;

    if (isCompleted) {
      const colorMatrix = new PIXI.ColorMatrixFilter();
      colorMatrix.desaturate();
      sprite.filters = [colorMatrix];
    } else {
      sprite.filters = [];
    }

    sprite.markerData.isCompleted = isCompleted;
    sprite.markerData.completedAt = completedItem
      ? completedItem.completedAt
      : null;

    if (pixiOverlay) pixiOverlay.redraw();

    logger.log("PixiOverlay", `Updated visual state for marker ${itemId}`);
  }
};

import { memoryManager } from "../../memory.js";

export const clearPixiOverlay = () => {
  if (pixiContainer) {
    if (memoryManager.debugMode) {
      console.log(
        `[PixiOverlay] Clearing ${pixiContainer.children.length} sprites from container`,
      );
    }

    pixiContainer.removeChildren();
    clearSpriteDataMap();
  }

  if (pixiOverlay && state.map) {
    try {
      if (state.map.hasLayer(pixiOverlay)) {
        state.map.removeLayer(pixiOverlay);
      }
    } catch (e) {}
    detachEventHandlers(state.map);

    if (state.map.options) {
      state.map.options.closePopupOnClick = true;
    }
  }

  logger.log("PixiOverlay", "GPU overlay cleared");
};

export const isPixiOverlayActive = () => {
  return pixiOverlay && state.map && state.map.hasLayer(pixiOverlay);
};

export const redrawPixiOverlay = () => {
  if (pixiOverlay && isPixiOverlayActive()) {
    pixiOverlay.redraw();
  }
};

export const disposePixiOverlay = () => {
  clearPixiOverlay();

  clearTextureCache();

  pixiOverlay = null;
  pixiContainer = null;
  supercluster = null;
  isInitialized = false;
  firstDraw = true;
  prevZoom = null;

  setState("pixiOverlay", null);
  setState("pixiContainer", null);

  logger.log("PixiOverlay", "GPU overlay disposed");
};
