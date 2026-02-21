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
    if (item.status === "rejected") return null;
    shouldRender = true;
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
