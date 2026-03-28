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

  // 유저 마커 차별화: 아이콘 외곽선 + 반짝이 애니메이션 + 프로필 뱃지 + 하단 라벨
  if (item.isBackend) {
    const w = texture.width;
    const h = texture.height;

    // 하단 "유저" 라벨 (텍스트 먼저 생성 후 박스를 텍스트에 맞춤)
    const label = new PIXI.Text("유저", {
      fontFamily: "Arial, sans-serif",
      fontSize: 18,
      fontWeight: "bold",
      fill: 0xFFFFFF,
      align: "center",
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, h / 2 + 2);

    const labelPadX = 4;
    const labelPadY = 2;
    const labelBg = new PIXI.Graphics();
    labelBg.beginFill(0x00BCD4, 0.95);
    labelBg.drawRoundedRect(
      -label.width / 2 - labelPadX,
      h / 2 + 2 - labelPadY,
      label.width + labelPadX * 2,
      label.height + labelPadY * 2,
      5
    );
    labelBg.endFill();
    sprite.addChild(labelBg);
    sprite.addChild(label);

    // 우측 상단 프로필 뱃지
    const badgeRadius = w * 0.22;
    const badgeX = w / 2 - badgeRadius * 0.1;
    const badgeY = -h / 2 + badgeRadius * 0.1;

    const badgeBg = new PIXI.Graphics();
    badgeBg.beginFill(0x00BCD4);
    badgeBg.drawCircle(badgeX, badgeY, badgeRadius + 2);
    badgeBg.endFill();
    badgeBg.lineStyle(1.5, 0xFFFFFF, 0.9);
    badgeBg.drawCircle(badgeX, badgeY, badgeRadius + 2);
    sprite.addChild(badgeBg);

    // 기본 유저 SVG 아이콘 (폴백)
    const userIconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" stroke="#fff" stroke-width="1">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    `;
    const userIconTexture = PIXI.Texture.from(`data:image/svg+xml;base64,${btoa(userIconSvg)}`);
    const userIconSprite = new PIXI.Sprite(userIconTexture);
    userIconSprite.width = badgeRadius * 2;
    userIconSprite.height = badgeRadius * 2;
    userIconSprite.anchor.set(0.5, 0.5);
    userIconSprite.position.set(badgeX, badgeY);

    // 프로필 이미지 원형 마스크
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawCircle(badgeX, badgeY, badgeRadius);
    mask.endFill();
    sprite.addChild(mask);
    sprite.addChild(userIconSprite);
    userIconSprite.mask = mask;

    // 실제 프로필 이미지 비동기 로드
    if (item.profile_image) {
      PIXI.Assets.load(item.profile_image)
        .then((profileTexture) => {
          userIconSprite.texture = profileTexture;
        })
        .catch((e) => {
          console.warn("Failed to load profile image:", item.profile_image, e);
        });
    }
  }

  sprite.alpha = isCompleted ? 0.4 : 1.0;

  if (isCompleted) {
    const colorMatrix = new PIXI.ColorMatrixFilter();
    colorMatrix.desaturate();
    sprite.filters = [colorMatrix];
  } else {
    sprite.filters = [];
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
