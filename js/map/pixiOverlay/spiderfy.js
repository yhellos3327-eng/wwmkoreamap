// @ts-check
/// <reference path="../../types.d.ts" />
const PIXI = /** @type {any} */ (window).PIXI;

import { ICON_SIZE } from "./config.js";
import { createSpriteForItem, addSpriteToDataMap } from "./spriteFactory.js";
import { updatePixiMarkers } from "./overlayCore.js";

let spiderfiedClusterId = null;
let spiderfyContainer = null;
let animationFrameId = null;
let spiderElements = [];
let currentCenterLatLng = null;

/** @returns {string|number|null} 스파이더파이 된 클러스터 ID. */
export const getSpiderfiedClusterId = () => spiderfiedClusterId;
/** @returns {any|null} 스파이더파이 컨테이너. */
export const getSpiderfyContainer = () => spiderfyContainer;

/**
 * 스파이더파이 효과를 지웁니다.
 */
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

/**
 * 줌/팬에 따라 스파이더파이 위치를 업데이트합니다.
 * @param {any} utils - PixiOverlay 유틸리티.
 */
export const updateSpiderfyPositions = (utils) => {
  if (!spiderfyContainer || !currentCenterLatLng || animationFrameId) return;

  const project = utils.latLngToLayerPoint;
  const scale = utils.getScale();
  const centerPoint = project(currentCenterLatLng);

  const count = spiderElements.length;
  const pixelLegLength = 40 + Math.min(count * 2, 100);
  const legLength = pixelLegLength / scale;

  // hitArea (첫 번째 graphics)와 legs (두 번째 graphics) 찾기
  const graphicsChildren = spiderfyContainer.children.filter(
    (c) => c instanceof PIXI.Graphics,
  );
  const hitAreaGraphics = graphicsChildren[0];
  const legsGraphics = graphicsChildren[1];

  if (hitAreaGraphics) {
    hitAreaGraphics.clear();
    hitAreaGraphics.beginFill(0x000000, 0.001);
    hitAreaGraphics.drawCircle(centerPoint.x, centerPoint.y, legLength * 1.1);
    hitAreaGraphics.endFill();
  }

  if (legsGraphics) {
    legsGraphics.clear();
    legsGraphics.lineStyle(2 / scale, 0x888888, 0.8);

    spiderElements.forEach((elem) => {
      const x = centerPoint.x + legLength * Math.cos(elem.angle);
      const y = centerPoint.y + legLength * Math.sin(elem.angle);

      elem.sprite.x = x;
      elem.sprite.y = y;

      if (utils.layerPointToLatLng) {
        const latLng = utils.layerPointToLatLng({ x, y });
        elem.sprite.markerData.lat = latLng.lat;
        elem.sprite.markerData.lng = latLng.lng;
      }

      const targetSize = ICON_SIZE / scale;
      elem.sprite.width = targetSize;
      elem.sprite.height = targetSize;

      legsGraphics.moveTo(centerPoint.x, centerPoint.y);
      legsGraphics.lineTo(x, y);
    });
  }
};

/**
 * 클러스터를 스파이더파이합니다.
 * @param {string|number} clusterId - 클러스터 ID.
 * @param {number[]} centerLatLng - 중심 좌표 [lat, lng].
 * @param {any[]} markers - 클러스터 내의 마커들.
 * @param {any} pixiContainer - PIXI 컨테이너.
 * @param {any} utils - PixiOverlay 유틸리티.
 */
export const spiderfyCluster = (
  clusterId,
  centerLatLng,
  markers,
  pixiContainer,
  utils,
) => {
  clearSpiderfy();

  spiderfiedClusterId = clusterId;
  currentCenterLatLng = centerLatLng;

  spiderfyContainer = new PIXI.Container();
  spiderfyContainer.sortableChildren = true;

  spiderfyContainer.zIndex = 9999;

  pixiContainer.addChild(spiderfyContainer);

  const project = utils.latLngToLayerPoint;
  const scale = utils.getScale();
  const centerPoint = project(centerLatLng);
  const count = markers.length;

  const circleStartAngle = 0;

  const pixelLegLength = 40 + Math.min(count * 2, 100);

  const legLength = pixelLegLength / scale;
  const angleStep = (Math.PI * 2) / count;

  // 다리/선을 클릭할 때 스파이더파이를 닫기 위한 배경 히트 영역
  const hitAreaGraphics = new PIXI.Graphics();
  hitAreaGraphics.interactive = true;
  hitAreaGraphics.cursor = "pointer";
  hitAreaGraphics.on("pointerdown", () => {
    clearSpiderfy();
    updatePixiMarkers();
  });
  spiderfyContainer.addChild(hitAreaGraphics);

  const legsGraphics = new PIXI.Graphics();
  spiderfyContainer.addChild(legsGraphics);

  spiderElements = [];

  markers.forEach((marker, index) => {
    const angle = circleStartAngle + index * angleStep;

    const item = marker.properties.item;
    const sprite = createSpriteForItem(item);

    if (sprite) {
      const targetSize = ICON_SIZE / scale;
      sprite.width = targetSize;
      sprite.height = targetSize;

      sprite.markerData = {
        ...sprite.markerData,
        isSpiderfied: true,
        originalLat: marker.geometry.coordinates[1],
        originalLng: marker.geometry.coordinates[0],
      };

      sprite.filters = [];

      sprite.x = centerPoint.x;
      sprite.y = centerPoint.y;

      spiderfyContainer.addChild(sprite);

      spiderElements.push({
        sprite,
        angle,
      });
    }
  });

  let start = null;
  const duration = 250;

  const animate = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);

    const ease = 1 - Math.pow(1 - progress, 3);

    const currentProject = utils.latLngToLayerPoint;
    const currentScale = utils.getScale();
    const currentCenter = currentProject(currentCenterLatLng);
    const currentLegLength = (pixelLegLength / currentScale) * ease;

    // 거미 다리를 덮는 투명한 히트 영역(원) 그리기
    hitAreaGraphics.clear();
    hitAreaGraphics.beginFill(0x000000, 0.001); // 거의 보이지 않지만 클릭 가능
    hitAreaGraphics.drawCircle(currentCenter.x, currentCenter.y, currentLegLength * 1.1);
    hitAreaGraphics.endFill();

    legsGraphics.clear();
    legsGraphics.lineStyle(2 / currentScale, 0x888888, 0.8);

    spiderElements.forEach((elem) => {
      const x = currentCenter.x + currentLegLength * Math.cos(elem.angle);
      const y = currentCenter.y + currentLegLength * Math.sin(elem.angle);

      elem.sprite.x = x;
      elem.sprite.y = y;

      if (utils.layerPointToLatLng) {
        const latLng = utils.layerPointToLatLng({ x, y });
        elem.sprite.markerData.lat = latLng.lat;
        elem.sprite.markerData.lng = latLng.lng;
      }

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
