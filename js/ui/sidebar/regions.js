// @ts-check
/// <reference path="../../types.d.ts" />
/* global L */
import { state } from "../../state.js";
import { t } from "../../utils.js";
import { saveFilterState } from "../../data.js";
import { updateMapVisibility } from "../../map.js";
import { updateToggleButtonsState } from "./core.js";

import { VirtualScroller } from "../virtual-scroller.js";

/**
 * @typedef {import("../../data/processors.js").MapItem} MapItem
 */

/**
 * @typedef {L.Layer & { regionTitle?: string }} RegionLayer
 */

let setAllCategoriesRef = null;
/** @type {VirtualScroller|null} */
let regionScroller = null;

/**
 * Injects the setAllCategories function reference.
 * @param {Function} fn - The function to set all categories.
 */
export const injectSetAllCategories = (fn) => {
  setAllCategoriesRef = fn;
};

/**
 * Renders a region item for the sidebar.
 * @param {string} region - The region name.
 * @returns {HTMLElement} The rendered element.
 */
const renderRegionItem = (region) => {
  const btn = document.createElement("div");
  btn.className = state.activeRegionNames.has(region)
    ? "cate-item active"
    : "cate-item";
  btn.dataset.region = region;
  btn.style.height = "60px";
  btn.style.boxSizing = "border-box";

  const regionItems = state.mapData.items.filter((item) => {
    const mapItem = /** @type {MapItem} */ (item);
    const itemRegion = mapItem.forceRegion || mapItem.region || "알 수 없음";
    const normalizedRegion = state.reverseRegionMap[itemRegion] || itemRegion;
    return normalizedRegion === region;
  });
  const count = regionItems.length;
  const regionMarkers = Array.from(state.allMarkers.values()).filter(
    (m) => m.region === region,
  );

  let translatedCount = 0;
  regionItems.forEach((item) => {
    if (
      item.isTranslated ||
      state.koDict[item.name] ||
      state.koDict[item.name?.trim()]
    ) {
      translatedCount++;
    }
  });

  const percentage =
    count > 0 ? Math.round((translatedCount / count) * 100) : 0;
  const translatedName = t(region);
  const regionIconUrl = "./icons/17310010083.png";

  let progressClass = "";
  if (percentage === 100) progressClass = "done";
  else if (percentage >= 70) progressClass = "high";
  else if (percentage >= 30) progressClass = "mid";
  else if (percentage > 0) progressClass = "low";

  btn.innerHTML = `
        <span class="cate-icon"><img src="${regionIconUrl}" alt="Region"></span>
        <div class="cate-info">
            <div class="cate-name"><span>${translatedName}</span></div>
            <div class="cate-meta">
                <span class="cate-count">${count}</span>
                <span class="cate-trans-stat ${progressClass}">${percentage}% 한글화</span>
            </div>
        </div>
        <button class="region-reset-btn" title="${translatedName} 초기화 (완료 기록 삭제)">↻</button>
    `;

  const resetBtn = btn.querySelector(".region-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (
        confirm(`${translatedName} 지역의 완료 기록을 모두 초기화하시겠습니까?`)
      ) {
        const { triggerSync } = await import("../../sync.js");
        const { updateSinglePixiMarker } =
          await import("../../map/pixiOverlay/overlayCore.js");

        const regionMarkerIds = new Set(regionMarkers.map((m) => m.id));

        const initialLength = state.completedList.length;
        state.completedList = state.completedList.filter(
          (item) => !regionMarkerIds.has(item.id),
        );

        if (state.completedList.length !== initialLength) {
          try {
            const { primaryDb } = await import("../../storage/db.js");
            const result = await primaryDb.set("completedList", state.completedList);
            if (!result || !result.success) {
              console.error("Failed to save completedList:", result?.error);
              alert("진행 상황 저장 중 오류가 발생했습니다.");
              return;
            }
            triggerSync();
          } catch (error) {
            console.error("Failed to reset region progress:", error);
            alert("진행 상황 저장 중 오류가 발생했습니다.");
            return;
          }

          regionMarkerIds.forEach((id) => {
            const target = state.allMarkers.get(id);
            if (target && target.marker) {
              if (target.marker._icon)
                target.marker._icon.classList.remove("completed-marker");
              if (
                target.marker.options.icon &&
                target.marker.options.icon.options
              ) {
                target.marker.options.icon.options.className =
                  target.marker.options.icon.options.className.replace(
                    " completed-marker",
                    "",
                  );
              }
              if (target.marker._completedMouseover) {
                target.marker.off(
                  "mouseover",
                  target.marker._completedMouseover,
                );
                target.marker.off("mouseout", target.marker._completedMouseout);
                delete target.marker._completedMouseover;
                delete target.marker._completedMouseout;
              }
            }
            updateSinglePixiMarker(id);
          });

          updateMapVisibility();
          alert(`${translatedName} 지역의 완료 기록이 초기화되었습니다.`);
        } else {
          alert(`${translatedName} 지역에 완료된 항목이 없습니다.`);
        }
      }
    });
  }

  btn.addEventListener("mouseenter", () => {
    if (state.regionLayerGroup) {
      state.regionLayerGroup.eachLayer((layer) => {
        const rLayer = /** @type {RegionLayer} */ (layer);
        if (rLayer.regionTitle === region) {
          rLayer.setStyle({ weight: 2, fillOpacity: 0.4 });
        }
      });
    }
    const nameWrapper = btn.querySelector(".cate-name");
    const nameSpan = nameWrapper ? nameWrapper.querySelector("span") : null;
    if (nameWrapper && nameSpan) {
      const overflow = nameWrapper.scrollWidth - nameWrapper.clientWidth;
      if (overflow > 0) {
        nameSpan.style.setProperty("--scroll-dist", `-${overflow + 10}px`);
        nameWrapper.classList.add("is-long");
      }
    }
  });

  btn.addEventListener("mouseleave", () => {
    if (state.regionLayerGroup) {
      state.regionLayerGroup.eachLayer((layer) => {
        const rLayer = /** @type {RegionLayer} */ (layer);
        if (rLayer.regionTitle === region) {
          rLayer.setStyle({ weight: 1, fillOpacity: 0.1 });
        }
      });
    }
    const nameWrapper = btn.querySelector(".cate-name");
    if (nameWrapper) nameWrapper.classList.remove("is-long");
  });

  btn.addEventListener("click", (e) => {
    if (state.activeRegionNames.has(region)) {
      state.activeRegionNames.delete(region);
      btn.classList.remove("active");
    } else {
      state.activeRegionNames.add(region);
      btn.classList.add("active");
      if (state.activeCategoryIds.size === 0 && setAllCategoriesRef) {
        setAllCategoriesRef(true);
      }
    }
    updateToggleButtonsState();
    updateMapVisibility();
    saveFilterState();

    const meta = state.regionMetaInfo[region];
    if (meta) {
      state.map.flyTo([meta.lat, meta.lng], meta.zoom, {
        animate: true,
        duration: 1.0,
      });
    }
  });

  return btn;
};

/**
 * Refreshes the region list in the sidebar.
 */
export const refreshSidebarLists = () => {
  let regionListEl = document.getElementById("region-list");
  if (!regionListEl) {
    const regionTab = document.getElementById("region-tab");
    if (regionTab) {
      regionListEl = document.createElement("div");
      regionListEl.id = "region-list";
      regionListEl.className = "category-list region-grid";
      regionTab.appendChild(regionListEl);
    } else {
      return;
    }
  }

  const sortedRegions = Array.from(state.uniqueRegions).sort((a, b) =>
    String(t(a)).localeCompare(String(t(b)), "ko"),
  );

  if (!regionScroller) {
    const scrollContainer = /** @type {HTMLElement} */ (
      regionListEl.closest(".filter-container")
    );

    regionScroller = new VirtualScroller({
      element: regionListEl,
      scrollContainer: scrollContainer,
      items: sortedRegions,
      renderItem: renderRegionItem,
      itemHeight: 85,
      columns: 2,
      buffer: 5,
    });
  } else {
    regionScroller.setItems(sortedRegions);
  }

  updateToggleButtonsState();
};

/**
 * Sets all regions to active or inactive.
 * @param {boolean} isActive - Whether to activate all regions.
 */
export const setAllRegions = (isActive) => {
  state.activeRegionNames.clear();
  if (isActive) {
    state.uniqueRegions.forEach((r) => state.activeRegionNames.add(r));
  }

  refreshSidebarLists();
  updateToggleButtonsState();
  updateMapVisibility();
  saveFilterState();
};
