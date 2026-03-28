// @ts-check
/// <reference path="../../types.d.ts" />
const L = /** @type {any} */ (window).L;
const PIXI = /** @type {any} */ (window).PIXI;

import { state } from "../../state.js";
import { ICON_MAPPING } from "../../config.js";
import { isPointInPolygon } from "../../utils.js";
import { getRegionPolygonsCache } from "../markerFactory.js";
import { createPopupHtml } from "../popup.js";
import {
  getIconUrl,
  getCachedTexture,
  getDefaultTexture,
} from "./textureManager.js";
import { loadComments } from "../../comments.js";
import { fetchVoteCounts } from "../../votes.js";

const spriteDataMap = new Map();
const itemIdToSpriteMap = new Map();

/**
 * 이미지의 알파 채널(형태)을 따라가는 커스텀 애니메이션 외곽선 필터
 * @class
 */
class OutlineFilter extends PIXI.Filter {
  /**
   * @param {number} thickness - 기본 외곽선 두께 (px)
   * @param {number} color - 외곽선 색상 (hex)
   */
  constructor(thickness = 2, color = 0xFFD700) {
    const vertex = `
      attribute vec2 aVertexPosition;
      attribute vec2 aTextureCoord;
      uniform mat3 projectionMatrix;
      varying vec2 vTextureCoord;
      void main(void) {
        gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
        vTextureCoord = aTextureCoord;
      }
    `;

    const fragment = `
      varying vec2 vTextureCoord;
      uniform sampler2D uSampler;
      uniform vec4 uOutlineColor;
      uniform vec2 uThickness;
      uniform float uTime;

      void main(void) {
        vec4 ownColor = texture2D(uSampler, vTextureCoord);
        if (ownColor.a > 0.5) {
          gl_FragColor = ownColor;
        } else {
          // 8방향 정밀 샘플링으로 외곽 보정
          float totalAlpha = 0.0;
          for (float i = 0.0; i < 6.28; i += 0.785) {
            totalAlpha += texture2D(uSampler, vTextureCoord + vec2(cos(i) * uThickness.x, sin(i) * uThickness.y)).a;
          }
          
          // 안티에일리싱 적용 (Sharper Smoothstep)
          float outlineAlpha = smoothstep(0.0, 0.9, totalAlpha * 0.3);

          if (outlineAlpha > 0.01) {
            // "빙그르르" 회전하는 황금 광택 효과 구현 (Premium Sharp Sweep)
            float angle = atan(vTextureCoord.y - 0.5, vTextureCoord.x - 0.5);
            
            // 더 날카롭고 빠른 회전 (uTime * 4.2, pow 16.0)
            float shine = sin(angle + uTime * 4.2);
            shine = pow(max(0.0, shine), 16.0) * 1.8; 
            
            // 고대비 리얼 골드 배합
            vec4 baseGold = vec4(1.0, 0.84, 0.0, 1.0); // Vivid Gold
            vec4 darkGold = vec4(0.7, 0.5, 0.1, 1.0);  // Shadow Gold
            vec4 shineColor = vec4(1.0, 1.0, 0.9, 1.0); // Pearl White Shine
            
            // 입체감을 위해 기본 골드에 약간의 쉐도우 믹스 + 강력한 하이라이트
            vec4 mixedGold = mix(darkGold, baseGold, 0.7 + sin(uTime * 2.0) * 0.1);
            vec4 finalColor = mix(mixedGold, shineColor, shine);
            
            gl_FragColor = finalColor * outlineAlpha;
          } else {
            gl_FragColor = vec4(0.0);
          }
        }
      }
    `;

    const r = ((color >> 16) & 0xFF) / 255;
    const g = ((color >> 8) & 0xFF) / 255;
    const b = (color & 0xFF) / 255;

    super(vertex, fragment, {
      uOutlineColor: [r, g, b, 1.0],
      uThickness: [0, 0],
      uTime: 0,
    });

    this.thickness = thickness;
    this.startTime = Date.now();

    // 전역 티커에 자동 등록 (애니메이션 구동)
    PIXI.Ticker.shared.add(this.update, this);
  }

  update() {
    this.uniforms.uTime = (Date.now() - this.startTime) / 1000.0;
  }

  /**
   * 필터 렌더링 시 두께 단위를 텍스처 좌표계로 변환
   */
  apply(filterManager, input, output, clearMode) {
    this.uniforms.uThickness[0] = this.thickness / input.filterFrame.width;
    this.uniforms.uThickness[1] = this.thickness / input.filterFrame.height;
    super.apply(filterManager, input, output, clearMode);
  }

  /**
   * 필터 파괴 시 티커에서 제거 (메모리 누수 방지)
   */
  destroy() {
    PIXI.Ticker.shared.remove(this.update, this);
    super.destroy();
  }
}

/** @returns {Map} 스프라이트 데이터 맵. */
export const getSpriteDataMap = () => spriteDataMap;
/**
 * 아이템 ID로 스프라이트를 가져옵니다.
 * @param {string|number} id - 아이템 ID.
 * @returns {any|undefined} 스프라이트.
 */
export const getSpriteById = (id) => itemIdToSpriteMap.get(String(id));

/**
 * 스프라이트 데이터 맵을 지웁니다.
 */
export const clearSpriteDataMap = () => {
  spriteDataMap.clear();
  itemIdToSpriteMap.clear();
};

/**
 * 스프라이트에 대한 팝업을 표시합니다.
 * @param {any} sprite - 스프라이트.
 * @returns {any|null} 팝업.
 */
export const showPopupForSprite = (sprite) => {
  if (!sprite.markerData) return null;

  const { item, lat, lng, region } = sprite.markerData;
  const popupContent = createPopupHtml(item, lat, lng, region);

  const popup = L.popup({
    offset: L.point(0, 0),
  })
    .setLatLng([lat, lng])
    .setContent(popupContent);

  popup.itemId = item.id;

  popup.openOn(state.map);

  if (loadComments) {
    loadComments(item.id);
  }
  fetchVoteCounts(item.id);

  return popup;
};

import { memoryManager } from "../../memory.js";

/**
 * 지도 아이템에 대한 PIXI 스프라이트를 생성합니다.
 * @param {any} item - 지도 아이템.
 * @returns {any|null} 스프라이트 또는 생성 실패 시 null.
 */
export const createSpriteForItem = (item) => {
  let catId = item.category;

  if (
    typeof ICON_MAPPING !== "undefined" &&
    ICON_MAPPING.hasOwnProperty(catId)
  ) {
    const mappedValue = ICON_MAPPING[catId];
    if (mappedValue === null) return null;
    catId = mappedValue;
  }

  const lat = parseFloat(item.lat ?? item.x);
  const lng = parseFloat(item.lng ?? item.y);
  if (isNaN(lat) || isNaN(lng)) return null;

  let finalRegionName = item.forceRegion || item.region || "알 수 없음";

  finalRegionName = state.reverseRegionMap[finalRegionName] || finalRegionName;

  const regionPolygonsCache = getRegionPolygonsCache();

  if (!item.forceRegion && regionPolygonsCache.length > 0) {
    for (const polyObj of regionPolygonsCache) {
      if (isPointInPolygon([lat, lng], polyObj.coords)) {
        finalRegionName = polyObj.title;
        item.region = polyObj.title;
        break;
      }
    }
  }

  let isCatActive = state.activeCategoryIds.has(catId);
  let isRegActive = state.activeRegionNames.has(finalRegionName);

  let shouldRender = isCatActive && isRegActive;
  if (state.showCommunityMarkers && item.isBackend) {
    if (item.status === "rejected" || item.status === "deleted") return null;
    // shouldRender는 isCatActive && isRegActive 유지 (카테고리/지역 필터 적용)
  }

  if (!shouldRender) {
    return null;
  }

  const completedItem = state.completedList.find(
    (c) => String(c.id) === String(item.id),
  );
  const isCompleted = !!completedItem;
  if (state.hideCompleted && isCompleted) return null;

  const iconUrl = getIconUrl(item.category);
  if (!iconUrl) return null;

  const texture = getCachedTexture(iconUrl) || getDefaultTexture();
  if (!texture) return null;

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5, 0.5);

  // 유저 마커 차별화: 이미지 형태를 따라가는 숨쉬는(Animation) 외곽선 필터 적용
  if (item.isBackend) {
    // 이미지 형태를 정밀하게 따라가는 인터랙티브 골드 애니메이션 외곽선
    const outlineFilter = new OutlineFilter(2.2, 0xFFD700);
    sprite.filters = sprite.filters || [];
    sprite.filters.push(outlineFilter);
  }

  sprite.alpha = isCompleted ? 0.4 : 1.0;

  if (isCompleted) {
    const colorMatrix = new PIXI.ColorMatrixFilter();
    colorMatrix.desaturate();
    sprite.filters = sprite.filters || [];
    sprite.filters.push(colorMatrix);
  }

  sprite.markerData = {
    item: item,
    lat: lat,
    lng: lng,
    region: finalRegionName,
    isCompleted: isCompleted,
    completedAt: completedItem?.completedAt,
  };

  memoryManager.track(sprite, `Sprite-${item.id}`);
  memoryManager.setMeta(sprite, {
    created: Date.now(),
    itemId: item.id,
    type: "PixiSprite",
  });

  itemIdToSpriteMap.set(String(item.id), sprite);

  return sprite;
};

/**
 * 데이터 맵에 스프라이트를 추가합니다.
 * @param {any} sprite - 스프라이트.
 * @param {any} item - 아이템.
 */
export const addSpriteToDataMap = (sprite, item) => {
  spriteDataMap.set(sprite, item);
};
