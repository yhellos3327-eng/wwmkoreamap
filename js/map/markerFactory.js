// @ts-check
const L = /** @type {any} */ (window).L;
import { ICON_MAPPING } from "../config.js";
import { state } from "../state.js";
import { isPointInPolygon } from "../utils.js";
import { markerPool } from "./MarkerPool.js";
import { createPopupHtml } from "./popup.js";
import {
  showCompletedTooltip,
  hideCompletedTooltip,
} from "./completedTooltip.js";
import { logMarkerDebugInfo } from "./markerDebug.js";
import { toggleCompleted } from "../ui.js";
import { loadComments } from "../comments.js";
import { fetchVoteCounts } from "../votes.js";
import { BACKEND_URL } from "../config.js";

let regionPolygonsCache = [];

/**
 * 지역 다각형 캐시를 설정합니다.
 * @param {any[]} cache - 설정할 캐시 데이터.
 */
export const setRegionPolygonsCache = (cache) => {
  regionPolygonsCache = cache;
};

/**
 * 지역 다각형 캐시를 가져옵니다.
 * @returns {any[]} 지역 다각형 캐시.
 */
export const getRegionPolygonsCache = () => regionPolygonsCache;

/**
 * 지도 아이템을 위한 마커를 생성합니다.
 * @param {any} item - 지도 아이템.
 * @returns {{marker: any, markerInfo: any}|null} 생성된 마커와 정보, 생성 실패 시 null.
 */
export const createMarkerForItem = (item) => {
  let catId = item.category;

  if (
    typeof ICON_MAPPING !== "undefined" &&
    ICON_MAPPING.hasOwnProperty(catId)
  ) {
    const mappedValue = ICON_MAPPING[catId];
    if (mappedValue === null) return null;
    catId = mappedValue;
  }

  const lat = parseFloat(item.x);
  const lng = parseFloat(item.y);
  if (isNaN(lat) || isNaN(lng)) return null;

  let finalRegionName = item.forceRegion || item.region || "알 수 없음";

  finalRegionName = state.reverseRegionMap[finalRegionName] || finalRegionName;

  if (!item.forceRegion && regionPolygonsCache.length > 0) {
    for (const polyObj of regionPolygonsCache) {
      if (isPointInPolygon([lat, lng], polyObj.coords)) {
        finalRegionName = polyObj.title;
        item.region = polyObj.title;
        break;
      }
    }
  }

  const isCatActive = state.activeCategoryIds.has(catId);
  const isRegActive = state.activeRegionNames.has(finalRegionName);

  if (!isCatActive || !isRegActive) return null;

  const completedItem = state.completedList.find(
    (c) => String(c.id) === String(item.id),
  );
  const isCompleted = !!completedItem;
  if (state.hideCompleted && isCompleted) return null;

  const categoryObj = state.mapData.categories.find((c) => c.id === catId);
  let iconUrl = "./icons/17310010088.png";
  let isDefault = true;

  if (categoryObj && categoryObj.image) {
    iconUrl = categoryObj.image;
    isDefault = false;
  }

  const w = item.imageSizeW || 44;
  const h = item.imageSizeH || 44;
  let iconClass = isCompleted
    ? "game-marker-icon completed-marker"
    : "game-marker-icon";
  if (isDefault) iconClass += " blue-overlay";
  if (state.activeQuestMarkerIds && state.activeQuestMarkerIds.has(String(item.id))) {
    iconClass += " quest-glow-marker";
  }

  const customIcon = L.icon({
    iconUrl: iconUrl,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
    popupAnchor: [0, 0],
    className: iconClass,
  });

  let markerTitle = item.name;
  if (isCompleted && completedItem.completedAt) {
    const completedDate = new Date(completedItem.completedAt);
    const timeStr = completedDate.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    markerTitle = `✓ ${item.name}\n완료: ${timeStr}`;
  }

  const marker = markerPool.getMarker(lat, lng, {
    icon: customIcon,
    title: markerTitle,
    alt: catId,
    itemId: item.id,
  });

  marker.off("click");
  marker.off("contextmenu");
  marker.off("mouseover");
  marker.off("mouseout");
  marker.off("popupopen");
  marker.unbindPopup();

  marker.on("click", async (e) => {
    if (e && e.originalEvent) e.originalEvent.stopPropagation();

    // [COMMUNITY TOOLBAR: DELETE MODE]
    // @ts-ignore
    const { devState } = await import("../dev-tools.js");
    if (devState && devState.isDeleteMode) {
      import("../ui/wiki.js").then(async wiki => {
        if (typeof wiki.openWikiEditModal === 'function') {
          // We need a way to trigger just the delete part, or open modal and auto-click delete?
          // The user requested 'tools', so maybe clicking a marker in delete mode should immediately prompt.
          // Let's re-use the logic from wiki.js openWikiEditModal's delete button but specialized.
          const reason = prompt(`[${item.name}] 이 마커의 삭제를 제안하시겠습니까?\n이유를 입력해주세요:`);
          if (reason) {
            const { getAuthToken } = await import("../auth.js");
            getAuthToken().then(async token => {
              const formData = new FormData();
              formData.append('target_marker_id', String(item.id));
              formData.append('is_official', String(!item.isBackend));
              formData.append('map_id', state.currentMapKey || 'qinghe');
              formData.append('deleted', 'true');
              formData.append('edit_reason', reason);
              formData.append('status', 'pending');

              try {
                const res = await fetch(`${BACKEND_URL}/api/revisions`, {
                  method: 'POST',
                  credentials: 'include',
                  body: formData,
                  headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                const result = await res.json();
                if (result.success) alert("삭제 제안이 제출되었습니다.");
                else alert("실패: " + result.error);
              } catch (err) { alert("서버 오류"); }
            });
          }
        }
      });
      return;
    }

    logMarkerDebugInfo(item, catId, finalRegionName, lat, lng);
  });

  marker.on("mousedown", (e) => {
    if (e.originalEvent.button === 1) {
      e.originalEvent.preventDefault();
      const textToCopy = `Override,"${catId}","${item.id}"`;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          console.log("Copied to clipboard:", textToCopy);
        })
        .catch((err) => {
          console.error("Failed to copy:", err);
        });
    }
  });

  marker.on("contextmenu", (e) => {
    e.originalEvent.preventDefault();
    toggleCompleted(item.id);
  });

  if (isCompleted && completedItem.completedAt) {
    marker.on("mouseover", () => {
      if (marker.getPopup() && marker.getPopup().isOpen()) return;
      showCompletedTooltip(
        { latlng: marker.getLatLng() },
        item.id,
        item.name,
        completedItem.completedAt,
      );
    });
    marker.on("mouseout", () => {
      hideCompletedTooltip();
    });
  }

  marker.on("popupopen", () => {
    hideCompletedTooltip();
    if (loadComments) loadComments(item.id);
    fetchVoteCounts(item.id, !!item.isBackend);
  });

  marker.bindPopup(() => createPopupHtml(item, lat, lng, finalRegionName));

  return {
    marker,
    markerInfo: {
      id: item.id,
      marker: marker,
      name: item.name.toLowerCase(),
      originalName: item.name,
      desc: (item.description || "").toLowerCase(),
      category: catId,
      region: finalRegionName,
      forceRegion: item.forceRegion,
      lat: lat,
      lng: lng,
    },
  };
};
