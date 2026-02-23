// @ts-check
/// <reference path="../types.d.ts" />
const L = /** @type {any} */ (window).L;
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
import { primaryDb } from "../storage/db.js";
import { createLogger } from "../utils/logStyles.js";
import { BACKEND_URL } from "../config.js";
import { isLoggedIn } from "../auth.js";

const log = createLogger("Navigation");

/**
 * Write queue for serialized Vault writes per key.
 * @type {Map<string, Promise<any>>}
 */
const vaultWriteQueues = new Map();

/**
 * Queue a Vault write to ensure serialized writes per key.
 * @param {string} key - The storage key.
 * @param {any} value - The value to write.
 * @param {string} label - Label for logging.
 * @returns {Promise<void>}
 */
const queueVaultWrite = async (key, value, label) => {
  const previousWrite = vaultWriteQueues.get(key) || Promise.resolve();

  const writePromise = previousWrite.then(async () => {
    try {
      let finalValue = value;
      // Filter out community markers from IndexedDB/Vault storage
      if (key === "completedList" && Array.isArray(value)) {
        finalValue = value.filter(item => !state.communityMarkers?.has(String(item.id)));
      }

      const result = await primaryDb.set(key, finalValue);
      if (!result || !result.success) {
        throw new Error(`Vault write failed: ${result?.error || 'Unknown error'}`);
      }
      log.vault(`${label} 저장 완료`, Array.isArray(value) ? value.length : value);
    } catch (e) {
      log.error(`${label} 저장 실패`, e);
      throw e;
    }
  }).catch(e => {
    // Re-throw without duplicate logging (inner catch already logged)
    throw e;
  });

  vaultWriteQueues.set(key, writePromise);
  return writePromise;
};

/**
 * @typedef {import("../data/processors.js").MapItem} MapItem
 */

/**
 * @typedef {MapItem & { marker?: any, sprite?: any }} MarkerInfo
 */

/**
 * Toggles the completed status of an item.
 * @param {string|number} id - The item ID.
 * @param {boolean} [skipSync=false] - Whether to skip backend sync (used for reverts).
 */
export const toggleCompleted = async (id, skipSync = false) => {
  const targetId = String(id);
  const numId = Number(id);
  const index = state.completedList.findIndex(
    (item) => String(item.id) === targetId,
  );

  let target = /** @type {MarkerInfo} */ (
    state.allMarkers.get(id) ??
    state.allMarkers.get(targetId) ??
    state.allMarkers.get(numId)
  );

  // Fallback check in all data sources
  if (!target) {
    const staticItem = state.mapData.items.find(i => String(i.id) === targetId);
    if (staticItem) {
      target = { ...staticItem, originalName: staticItem.name };
    } else if (state.communityMarkers) {
      const communityItem = state.communityMarkers.get(targetId);
      if (communityItem) {
        target = { ...communityItem, isBackend: true };
      }
    }
  }

  const isNowCompleted = index === -1;
  const completedAt = Date.now();

  // Backend Sync (Dedicated Table Sync)
  if (isLoggedIn() && !skipSync) {
    fetch(`${BACKEND_URL}/api/markers/${id}/toggle-complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include" // Send cookies
    }).then(async res => {
      if (!res.ok) {
        throw new Error("Backend sync failed");
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      log.success("Backend Sync", `서버 동기화 성공: ${targetId}`);
    }).catch(err => {
      console.error("Backend completion toggle failed", err);
      import("../sync/ui.js").then(({ showSyncToast }) => {
        showSyncToast("서버와 동기화 실패. 완료 상태가 취소됩니다.", "error");
      });
      // Revert state if failed
      toggleCompleted(id, true);
    });
  } else if (!isLoggedIn() && target?.isBackend) {
    import("../sync/ui.js").then(({ showSyncToast }) => {
      showSyncToast("커뮤니티 마커를 체크하려면 로그인이 필요합니다.", "error");
    });
    return;
  }

  // Log toggle action
  if (isNowCompleted) {
    log.success(`완료 추가: ${targetId}`, { before: state.completedList.length });
  } else {
    log.warn(`완료 삭제: ${targetId}`, { before: state.completedList.length });
  }

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
          targetId,
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
    // Remove ALL instances of this ID to fix any duplication bugs (preserves array reference)
    for (let i = state.completedList.length - 1; i >= 0; i--) {
      if (String(state.completedList[i].id) === targetId) {
        state.completedList.splice(i, 1);
      }
    }

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
  // DEXIE.JS MIGRATION: Save to Vault only (localStorage no longer used)
  if (!target?.isBackend) {
    queueVaultWrite("completedList", state.completedList, "completedList");
    triggerSync();
  }

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
          (item) => String(item.id) === targetId,
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
      String(state.map._popup.itemId) === targetId
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

/**
 * Formats a timestamp to a human-readable relative time.
 * @param {number} timestamp - The timestamp.
 * @returns {string} The formatted time string.
 */
const formatCompletedTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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

/**
 * Toggles the favorite status of an item.
 * @param {string|number} id - The item ID.
 */
export const toggleFavorite = (id) => {
  const strId = String(id);
  const index = state.favorites.findIndex((fav) => String(fav) === strId);
  let target = /** @type {MarkerInfo} */ (
    state.allMarkers.get(id) || state.allMarkers.get(strId)
  );

  if (!target) {
    const item = state.mapData.items.find(i => String(i.id) === strId);
    if (item) {
      target = { ...item, originalName: item.name };
    }
  }
  const isNowFavorite = index === -1;

  // Log toggle action
  if (isNowFavorite) {
    log.success(`즐겨찾기 추가: ${strId}`, state.favorites.length);
  } else {
    log.warn(`즐겨찾기 삭제: ${strId}`, { before: state.favorites.length });
  }

  if (isNowFavorite) state.favorites.push(strId);
  else state.favorites.splice(index, 1);

  // DEXIE.JS MIGRATION: Save to Vault only (localStorage no longer used)
  queueVaultWrite("favorites", state.favorites, "favorites");

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

/**
 * Shares the location of an item by copying a URL to clipboard.
 * @param {string|number} id - The item ID.
 */
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

/**
 * Expands the related items list.
 * @param {HTMLElement} btn - The button element.
 */
export const expandRelated = (btn) => {
  const list = btn.previousElementSibling;
  if (list)
    list
      .querySelectorAll(".related-item.hidden")
      .forEach((item) => item.classList.remove("hidden"));
  btn.remove();
};

/**
 * Jumps to a specific item on the map.
 * @param {string|number} id - The item ID.
 */
export const jumpToId = (id) => {
  console.log("[Navigation] jumpToId called with:", id);

  // Close sidebar on mobile/small screens to show the map
  if (window.innerWidth <= 768) {
    import("./sidebar.js").then(({ toggleSidebar }) => {
      toggleSidebar("close");
    });
  }

  // Close AI chat or other modals if they might be covering the map
  const aiChatModal = document.getElementById("ai-chat-modal");
  if (aiChatModal && !aiChatModal.classList.contains("hidden")) {
    aiChatModal.classList.add("hidden");
  }

  let target = /** @type {MarkerInfo} */ (
    state.allMarkers.get(id) || state.allMarkers.get(String(id))
  );

  if (!target) {
    const item = state.mapData.items.find((i) => String(i.id) === String(id));
    if (item) {
      console.log("[Navigation] Found item in mapData, moving to location");
      import("../map/pixiOverlay/spriteFactory.js").then(
        ({ getSpriteById }) => {
          const sprite = getSpriteById(id);
          moveToLocation(
            [parseFloat(item.x), parseFloat(item.y)],
            sprite,
            item.forceRegion || item.region,
            item.id,
          );
        },
      );
      return;
    }
    console.warn("[Navigation] jumpToId: target not found for ID", id);
  }
  if (target) {
    const latlng = target.marker
      ? target.marker.getLatLng()
      : [target.lat, target.lng];

    console.log("[Navigation] Target found, jumping to:", latlng, "Region:", target.region);

    moveToLocation(
      latlng,
      target.marker || target.sprite,
      target.region,
      target.id,
    );
  }
};


/**
 * Finds an item by ID, activates necessary filters, and navigates to it.
 * @param {string|number} id - The item ID.
 * @returns {Promise<void>}
 */
export const findItem = async (id) => {
  const targetId = String(id);
  /** @type {any} */ (window).findItem = findItem;
  let target = /** @type {MarkerInfo} */ (
    state.allMarkers.get(id) || state.allMarkers.get(targetId)
  );

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
    const hideToggle = /** @type {HTMLInputElement} */ (
      document.getElementById("toggle-hide-completed")
    );
    if (hideToggle) hideToggle.checked = false;
  }

  if (filtersChanged) {
    await updateMapVisibility();
    updateToggleButtonsState();
    saveFilterState();
  }

  setTimeout(() => {
    target = /** @type {MarkerInfo} */ (
      state.allMarkers.get(id) || state.allMarkers.get(targetId)
    );

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
