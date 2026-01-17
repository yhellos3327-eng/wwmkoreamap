import { ICON_SIZE } from "./config.js";
import { createSpriteForItem, addSpriteToDataMap } from "./spriteFactory.js";

// Spiderfy 상태 관리
let spiderfiedClusterId = null;
let spiderfyContainer = null; // Spiderfy된 요소들을 담을 컨테이너
let animationFrameId = null;
let spiderElements = [];
let currentCenterLatLng = null;

export const getSpiderfiedClusterId = () => spiderfiedClusterId;
export const getSpiderfyContainer = () => spiderfyContainer;

export const clearSpiderfy = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (spiderfyContainer) {
    if (spiderfyContainer.parent) {
      spiderfyContainer.parent.removeChild(spiderfyContainer);
    }
    spiderfyContainer.destroy({ children: true });
    spiderfyContainer = null;
  }
  spiderfiedClusterId = null;
  spiderElements = [];
  currentCenterLatLng = null;
};

export const updateSpiderfyPositions = (utils) => {
  if (!spiderfyContainer || !currentCenterLatLng || animationFrameId) return;

  const project = utils.latLngToLayerPoint;
  const scale = utils.getScale();
  const centerPoint = project(currentCenterLatLng);

  // Re-calculate leg length based on new scale
  const count = spiderElements.length;
  const pixelLegLength = 40 + Math.min(count * 2, 100);
  const legLength = pixelLegLength / scale;

  // Update graphics
  const legsGraphics = spiderfyContainer.children.find(
    (c) => c instanceof PIXI.Graphics,
  );
  if (legsGraphics) {
    legsGraphics.clear();
    legsGraphics.lineStyle(2 / scale, 0x888888, 0.8);

    spiderElements.forEach((elem) => {
      const x = centerPoint.x + legLength * Math.cos(elem.angle);
      const y = centerPoint.y + legLength * Math.sin(elem.angle);

      elem.sprite.x = x;
      elem.sprite.y = y;

      // Update LatLng for hit detection
      if (utils.layerPointToLatLng) {
        const latLng = utils.layerPointToLatLng({ x, y });
        elem.sprite.markerData.lat = latLng.lat;
        elem.sprite.markerData.lng = latLng.lng;
      }

      // Update sprite size if needed (optional, usually handled by scale)
      const targetSize = ICON_SIZE / scale;
      elem.sprite.width = targetSize;
      elem.sprite.height = targetSize;

      legsGraphics.moveTo(centerPoint.x, centerPoint.y);
      legsGraphics.lineTo(x, y);
    });
  }
};

export const spiderfyCluster = (
  clusterId,
  centerLatLng,
  markers,
  pixiContainer,
  utils,
) => {
  clearSpiderfy(); // 기존 Spiderfy 제거

  spiderfiedClusterId = clusterId;
  currentCenterLatLng = centerLatLng;

  spiderfyContainer = new PIXI.Container();
  spiderfyContainer.sortableChildren = true;
  // zIndex를 높게 설정하여 다른 마커들 위에 표시
  spiderfyContainer.zIndex = 9999;

  pixiContainer.addChild(spiderfyContainer);

  const project = utils.latLngToLayerPoint;
  const scale = utils.getScale();
  const centerPoint = project(centerLatLng);
  const count = markers.length;

  // 배치 파라미터
  const circleStartAngle = 0;
  // 기본 거리 + 개수에 따른 추가 거리 (화면 픽셀 단위)
  const pixelLegLength = 40 + Math.min(count * 2, 100);

  // PixiOverlay 컨테이너 스케일에 맞춰 보정
  const legLength = pixelLegLength / scale;
  const angleStep = (Math.PI * 2) / count;

  // 다리(Leg) 그리기용 Graphics
  const legsGraphics = new PIXI.Graphics();
  spiderfyContainer.addChild(legsGraphics);

  // 스프라이트 미리 생성 및 데이터 준비
  spiderElements = [];

  markers.forEach((marker, index) => {
    const angle = circleStartAngle + index * angleStep;

    // 마커 스프라이트 생성
    const item = marker.properties.item;
    const sprite = createSpriteForItem(item);

    if (sprite) {
      const targetSize = ICON_SIZE / scale;
      sprite.width = targetSize;
      sprite.height = targetSize;

      // Spiderfy된 마커임을 표시
      sprite.markerData = {
        ...sprite.markerData,
        isSpiderfied: true,
        originalLat: marker.geometry.coordinates[1],
        originalLng: marker.geometry.coordinates[0],
      };

      // 필터 초기화
      sprite.filters = [];

      // 초기 위치는 중심
      sprite.x = centerPoint.x;
      sprite.y = centerPoint.y;

      spiderfyContainer.addChild(sprite);

      spiderElements.push({
        sprite,
        angle,
        // targetX/Y는 애니메이션 루프에서 계산
      });
    }
  });

  // 애니메이션 실행
  let start = null;
  const duration = 250; // ms

  const animate = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    // Cubic ease out
    const ease = 1 - Math.pow(1 - progress, 3);

    // Update center point and scale in case map moved
    const currentProject = utils.latLngToLayerPoint;
    const currentScale = utils.getScale();
    const currentCenter = currentProject(currentCenterLatLng);
    const currentLegLength = (pixelLegLength / currentScale) * ease;

    legsGraphics.clear();
    legsGraphics.lineStyle(2 / currentScale, 0x888888, 0.8);

    spiderElements.forEach((elem) => {
      const x = currentCenter.x + currentLegLength * Math.cos(elem.angle);
      const y = currentCenter.y + currentLegLength * Math.sin(elem.angle);

      elem.sprite.x = x;
      elem.sprite.y = y;

      // Update LatLng for hit detection
      if (utils.layerPointToLatLng) {
        const latLng = utils.layerPointToLatLng({ x, y });
        elem.sprite.markerData.lat = latLng.lat;
        elem.sprite.markerData.lng = latLng.lng;
      }

      // Update size
      const targetSize = ICON_SIZE / currentScale;
      elem.sprite.width = targetSize;
      elem.sprite.height = targetSize;

      legsGraphics.moveTo(currentCenter.x, currentCenter.y);
      legsGraphics.lineTo(x, y);
    });

    utils.getRenderer().render(pixiContainer);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      animationFrameId = null;
    }
  };

  animationFrameId = requestAnimationFrame(animate);
};
