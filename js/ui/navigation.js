import { state } from "../state.js";
import {
  updateMapVisibility,
  moveToLocation,
  createMarkerForItem,
} from "../map.js";
import { saveFilterState } from "../data.js";
import { t } from "../utils.js";
import { setAllRegions, updateToggleButtonsState } from "./sidebar.js";
import { renderFavorites } from "./sidebar.js";
import { logger } from "../logger.js";
import { showCompletedTooltip, hideCompletedTooltip } from "../map/markers.js";
import { triggerSync } from "../sync.js";
import { updateSinglePixiMarker } from "../map/pixiOverlay/overlayCore.js";

export const toggleCompleted = (id) => {
  const targetId = String(id);
  const numId = Number(id);
  const index = state.completedList.findIndex(
    (item) => String(item.id) === targetId,
  );
  
  const target =
    state.allMarkers.get(id) ??
    state.allMarkers.get(targetId) ??
    state.allMarkers.get(numId);
  const isNowCompleted = index === -1;
  const completedAt = Date.now();

  if (isNowCompleted) {
    state.completedList.push({ id: targetId, completedAt });
    if (target?.marker) {
      target.marker._icon?.classList.add("completed-marker");
      
      if (target.marker.options?.icon?.options) {
        target.marker.options.icon.options.className += " completed-marker";
      }

      const mouseoverHandler = (e) => {
        showCompletedTooltip(
          e,
          strId,
          target.originalName || target.name,
          completedAt,
        );
      };
      const mouseoutHandler = () => {
        hideCompletedTooltip();
      };
      target.marker._completedMouseover = mouseoverHandler;
      target.marker._completedMouseout = mouseoutHandler;
      target.marker.on("mouseover", mouseoverHandler);
      target.marker.on("mouseout", mouseoutHandler);
    }
  } else {
    state.completedList.splice(index, 1);
    if (target?.marker) {
      target.marker._icon?.classList.remove("completed-marker");
      
      if (target.marker.options?.icon?.options) {
        target.marker.options.icon.options.className =
          target.marker.options.icon.options.className.replace(
            " completed-marker",
            "",
          );
      }

      if (target.marker._completedMouseover) {
        target.marker.off("mouseover", target.marker._completedMouseover);
        target.marker.off("mouseout", target.marker._completedMouseout);
        delete target.marker._completedMouseover;
        delete target.marker._completedMouseout;
      }
      hideCompletedTooltip();
    }
  }
  localStorage.setItem("wwm_completed", JSON.stringify(state.completedList));
  triggerSync();

  updateSinglePixiMarker(targetId);

  const popupContainer = document.querySelector(
    `.popup-container[data-id="${id}"]`,
  );
  if (popupContainer) {
    const completeBtn = popupContainer.querySelector(".btn-complete");
    if (completeBtn) {
      completeBtn.classList.toggle("active", isNowCompleted);
      if (isNowCompleted) {
        const completedItem = state.completedList.find(
          (item) => String(item.id) === strId,
        );
        const timeStr = completedItem?.completedAt
          ? formatCompletedTime(completedItem.completedAt)
          : "";
        completeBtn.innerHTML = `완료됨${timeStr ? `<span class="completed-time">${timeStr}</span>` : ""}`;
      } else {
        completeBtn.textContent = "완료 체크";
      }
    }
  }

  if (state.closeOnComplete && isNowCompleted) {
    if (
      state.map &&
      state.map._popup &&
      String(state.map._popup.itemId) === strId
    ) {
      state.map.closePopup();
    } else if (target?.marker?.isPopupOpen?.()) {
      target.marker.closePopup();
    }
  }
  if (state.hideCompleted) updateMapVisibility();

  
  import("../map/regions.js").then(
    ({ renderRegionPolygons, updateRegionOverlay }) => {
      renderRegionPolygons(state.regionData);
      updateRegionOverlay();
    },
  );
};

const formatCompletedTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  }
};

export { formatCompletedTime };

export const toggleFavorite = (id) => {
  const strId = String(id);
  const index = state.favorites.findIndex((fav) => String(fav) === strId);
  const target = state.allMarkers.get(id) || state.allMarkers.get(strId);
  const isNowFavorite = index === -1;

  if (isNowFavorite) state.favorites.push(strId);
  else state.favorites.splice(index, 1);
  localStorage.setItem("wwm_favorites", JSON.stringify(state.favorites));
  triggerSync();
  renderFavorites();
  const popupContainer = document.querySelector(
    `.popup-container[data-id="${id}"]`,
  );
  if (popupContainer) {
    const favBtn = popupContainer.querySelector(".btn-fav");
    if (favBtn) {
      favBtn.classList.toggle("active", isNowFavorite);
      favBtn.textContent = isNowFavorite ? "★" : "☆";
    }
  }
};

export const shareLocation = (id) => {
  const mapKey = state.currentMapKey ?? "qinghe";
  const shareUrl = `https://wwmmap.kr?map=${mapKey}&id=${id}`;
  navigator.clipboard
    .writeText(shareUrl)
    .then(() => {
      import("../sync/ui.js").then(({ showSyncToast }) => {
        showSyncToast("🔗 링크가 클립보드에 복사되었습니다!", "success");
      });
    })
    .catch((err) => prompt("링크 복사:", shareUrl));
};

export const expandRelated = (btn) => {
  const list = btn.previousElementSibling;
  if (list)
    list
      .querySelectorAll(".related-item.hidden")
      .forEach((item) => item.classList.remove("hidden"));
  btn.remove();
};

export const jumpToId = (id) => {
  const target = state.allMarkers.get(id) || state.allMarkers.get(String(id));
  if (target) {
    const latlng = target.marker
      ? target.marker.getLatLng()
      : [target.lat, target.lng];
    moveToLocation(
      latlng,
      target.marker || target.sprite,
      target.region,
      target.id,
    );
  }
};

export const findItem = async (id) => {
  const targetId = String(id);
  window.findItem = findItem;
  let target = state.allMarkers.get(id) || state.allMarkers.get(targetId);

  if (target) {
    const latlng = target.marker
      ? target.marker.getLatLng()
      : [target.lat, target.lng];
    moveToLocation(
      latlng,
      target.marker || target.sprite,
      target.region,
      target.id,
    );
    logger.success("Navigation", `[${target.name}] 마커로 이동`);
    return;
  }
  const item = state.mapData.items.find((i) => String(i.id) === targetId);

  if (!item) {
    logger.warn("Navigation", `ID [${targetId}]를 찾을 수 없음`);
    return;
  }
  logger.log(
    "Navigation",
    `숨겨진 항목 발견: ${t(item.name)} (ID: ${targetId}) - 필터 활성화`,
  );
  let filtersChanged = false;
  if (!state.activeCategoryIds.has(item.category)) {
    state.activeCategoryIds.add(item.category);
    filtersChanged = true;
  }
  if (state.activeRegionNames.size !== state.uniqueRegions.size) {
    setAllRegions(true);
    filtersChanged = true;
  }

  
  if (state.hideCompleted) {
    state.hideCompleted = false;
    filtersChanged = true;
    const hideToggle = document.getElementById("toggle-hide-completed");
    if (hideToggle) hideToggle.checked = false;
  }

  if (filtersChanged) {
    await updateMapVisibility();
    updateToggleButtonsState();
    saveFilterState();
  }

  
  setTimeout(() => {
    target = state.allMarkers.get(id) || state.allMarkers.get(targetId);

    
    if (!target) {
      const markerData = createMarkerForItem(item);
      if (markerData) {
        state.allMarkers.set(markerData.markerInfo.id, markerData.markerInfo);
        target = markerData.markerInfo;
        logger.log("Navigation", `마커 수동 생성 완료: ${item.id}`);
      }
    }

    if (target) {
      const latlng = target.marker
        ? target.marker.getLatLng()
        : [target.lat, target.lng];
      moveToLocation(
        latlng,
        target.marker || target.sprite,
        target.region,
        target.id,
      );
      logger.success("Navigation", `[${target.name}] 위치로 이동 완료`);
    } else {
      logger.error("Navigation", "필터 활성화 후 마커 생성 실패");
    }
  }, 200);
};

export const openReportPage = (itemId) => {
  const item = state.allMarkers.get(itemId);
  const panel = document.getElementById("report-panel");
  let template = "";

  if (item) {
    const mapNames = { qinghe: "청하", kaifeng: "개봉" };
    const mapName = mapNames[state.currentMapKey] || state.currentMapKey;
    const locationUrl = `https://wwmmap.kr?map=${state.currentMapKey}&id=${item.id}`;

    template = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📢 WWM 한국어 맵 오류 제보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ 📍 마커 정보 ]
• 지도: ${mapName} (${state.currentMapKey})
• 분류: ${item.category}
• 지역: ${item.region}
• ID: ${item.id}
• 좌표: ${Number(item.lat).toFixed(2)}, ${Number(item.lng).toFixed(2)}
• 링크: ${locationUrl}

[ 📝 제보 내용 ]
(여기에 오류 내용을 적어주세요. 예: 위치가 다름, 이름 오타 등)


[ 📸 스크린샷 ]
(이미지를 붙여넣어주세요)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
감사합니다! 개발자가 확인 후 수정하겠습니다.
`;

    navigator.clipboard
      .writeText(template)
      .then(() => {
        import("../sync/ui.js").then(({ showSyncToast }) => {
          showSyncToast(
            "📋 제보 양식이 복사되었습니다. 본문에 붙여넣어주세요!",
            "success",
          );
        });
      })
      .catch(() => {});
  }

  if (panel) {
    const embed = document.getElementById("report-embed");
    if (embed && !embed.getAttribute("data")) {
      embed.setAttribute("data", "https://arca.live/b/wwmmap/write");
    }
    panel.classList.add("open");
  } else {
    window.open("https://arca.live/b/wwmmap/write", "_blank");
  }
};
