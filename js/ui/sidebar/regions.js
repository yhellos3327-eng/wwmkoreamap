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
  const isActive = state.activeRegionNames.has(region);
  btn.className = isActive ? "cate-item active" : "cate-item";
  btn.dataset.region = region;
  btn.style.height = "60px";
  btn.style.boxSizing = "border-box";

  // Accessibility
  btn.setAttribute("role", "button");
  btn.setAttribute("tabindex", "0");
  btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  btn.setAttribute("aria-label", `${t(region)} 지역 선택`);

  const regionItems = state.mapData.items.filter((item) => {
    const mapItem = /** @type {MapItem} */ (item);
    const itemRegion = mapItem.forceRegion || mapItem.region || "알 수 없음";
    const normalizedRegion = state.reverseRegionMap[itemRegion] || itemRegion;
    return normalizedRegion === region;
  });
  const count = regionItems.length;

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
        <span class="cate-icon">
          <img src="${regionIconUrl}" alt="Region">
        </span>
        <div class="cate-info">
            <div class="cate-name"><span>${translatedName}</span></div>
            <div class="cate-meta">
                <span class="cate-count">${count}</span>
                <span class="cate-trans-stat ${progressClass}">${percentage}% 한글화</span>
            </div>
        </div>

        <button class="region-complete-btn" style="display: none;">Complete</button>
    `;

  // ... existing event listeners ...
  const completeBtn = btn.querySelector(".region-complete-btn");
  if (completeBtn) {
    completeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`${translatedName} 지역의 모든 항목을 완료 처리하시겠습니까?`)) {
        const { triggerSync } = await import("../../sync.js");
        const { updateSinglePixiMarker } = await import("../../map/pixiOverlay/overlayCore.js");
        const { primaryDb } = await import("../../storage/db.js");

        const regionMarkerIds = regionItems.map((item) => String(item.id));
        const completedAt = Date.now();
        let changed = false;

        regionMarkerIds.forEach(id => {
          if (!state.completedList.find(c => String(c.id) === id)) {
            state.completedList.push({ id, completedAt });
            changed = true;
          }
        });

        if (changed) {
          try {
            await primaryDb.set("completedList", state.completedList);
            triggerSync();
          } catch (error) {
            console.error("Failed to save completedList:", error);
            alert("저장 중 오류가 발생했습니다.");
            return;
          }

          regionMarkerIds.forEach((id) => {
            const target = state.allMarkers.get(id) || state.allMarkers.get(Number(id));
            if (target && target.marker) {
              if (target.marker._icon) target.marker._icon.classList.add("completed-marker");
              if (target.marker.options.icon?.options) {
                target.marker.options.icon.options.className += " completed-marker";
              }
            }
            updateSinglePixiMarker(id);
          });

          updateMapVisibility();
          alert(`${translatedName} 지역 완료 처리가 끝났습니다.`);
        } else {
          alert("이미 모든 항목이 완료되어 있습니다.");
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

  const toggleRegion = () => {
    if (state.activeRegionNames.has(region)) {
      state.activeRegionNames.delete(region);
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    } else {
      state.activeRegionNames.add(region);
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
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
  };

  btn.addEventListener("click", toggleRegion);

  // Keyboard support
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleRegion();
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

// --- Progress UI Helpers ---

const createProgressUI = () => {
  if (document.getElementById("batch-progress-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "batch-progress-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s ease;
    backdrop-filter: blur(4px);
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    background: var(--bg-panel);
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    width: 320px;
    text-align: center;
    border: 1px solid var(--border);
    transform: translateY(20px);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;

  const title = document.createElement("h3");
  title.id = "batch-progress-title";
  title.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 1.1rem;
    color: var(--text-main);
  `;

  const barContainer = document.createElement("div");
  barContainer.style.cssText = `
    width: 100%;
    height: 8px;
    background: var(--bg-item);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  `;

  const bar = document.createElement("div");
  bar.id = "batch-progress-bar";
  bar.style.cssText = `
    width: 0%;
    height: 100%;
    background: var(--accent);
    transition: width 0.1s linear;
  `;

  const text = document.createElement("p");
  text.id = "batch-progress-text";
  text.style.cssText = `
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-muted);
  `;

  barContainer.appendChild(bar);
  card.appendChild(title);
  card.appendChild(barContainer);
  card.appendChild(text);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Force reflow
  overlay.offsetHeight;
  overlay.style.opacity = "1";
  card.style.transform = "translateY(0)";
};

const updateProgress = (percent, message) => {
  const bar = document.getElementById("batch-progress-bar");
  const text = document.getElementById("batch-progress-text");
  if (bar) bar.style.width = `${percent}%`;
  if (text && message) text.textContent = message;
};

const removeProgressUI = () => {
  const overlay = document.getElementById("batch-progress-overlay");
  if (overlay) {
    overlay.style.opacity = "0";
    const card = overlay.querySelector("div");
    if (card) card.style.transform = "translateY(20px)";
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }
};

// --- Batch Processing Logic ---

/**
 * Processes markers in batches to prevent UI freezing.
 * @param {Array<string>} ids - List of marker IDs to process.
 * @param {'complete'|'reset'} action - Action to perform.
 * @param {string} title - Title for the progress modal.
 */
const processBatchMarkers = async (ids, action, title) => {
  createProgressUI();
  document.getElementById("batch-progress-title").textContent = title;

  const { triggerSync } = await import("../../sync.js");
  const { updateSinglePixiMarker } = await import("../../map/pixiOverlay/overlayCore.js");
  const { primaryDb } = await import("../../storage/db.js");

  const total = ids.length;
  const BATCH_SIZE = 50; // Process 50 markers per frame
  let processed = 0;

  // 1. Update State & DB first (Data consistency)
  const completedAt = Date.now();
  let stateChanged = false;

  if (action === "complete") {
    ids.forEach(id => {
      if (!state.completedList.find(c => String(c.id) === id)) {
        state.completedList.push({ id, completedAt });
        stateChanged = true;
      }
    });
  } else if (action === "reset") {
    const idSet = new Set(ids);
    const initialLen = state.completedList.length;
    state.completedList = state.completedList.filter(c => !idSet.has(String(c.id)));
    if (state.completedList.length !== initialLen) {
      stateChanged = true;
    }
  }

  if (stateChanged) {
    try {
      await primaryDb.set("completedList", state.completedList);
      triggerSync();
    } catch (error) {
      console.error("Failed to save state:", error);
      alert("저장 중 오류가 발생했습니다.");
      removeProgressUI();
      return;
    }
  } else {
    removeProgressUI();
    alert(action === "complete" ? "이미 모든 항목이 완료되어 있습니다." : "초기화할 항목이 없습니다.");
    return;
  }

  // 2. Update UI (Markers) in batches
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);

    batch.forEach(id => {
      const target = state.allMarkers.get(id) || state.allMarkers.get(Number(id));
      if (target && target.marker) {
        if (action === "complete") {
          if (target.marker._icon) target.marker._icon.classList.add("completed-marker");
          if (target.marker.options.icon?.options) {
            target.marker.options.icon.options.className += " completed-marker";
          }
        } else {
          if (target.marker._icon) target.marker._icon.classList.remove("completed-marker");
          if (target.marker.options.icon?.options) {
            target.marker.options.icon.options.className = target.marker.options.icon.options.className.replace(" completed-marker", "");
          }
          // Remove hover handlers if present
          if (target.marker._completedMouseover) {
            target.marker.off("mouseover", target.marker._completedMouseover);
            target.marker.off("mouseout", target.marker._completedMouseout);
            delete target.marker._completedMouseover;
            delete target.marker._completedMouseout;
          }
        }
      }
      updateSinglePixiMarker(id);
    });

    processed += batch.length;
    const percent = Math.min(100, Math.round((processed / total) * 100));
    updateProgress(percent, `${processed} / ${total} 처리 중...`);

    // Yield control to main thread to allow UI rendering
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  updateMapVisibility();
  removeProgressUI();

  // Slight delay before alert to allow UI to settle
  setTimeout(() => {
    alert(action === "complete" ? "완료 처리가 끝났습니다." : "초기화가 완료되었습니다.");
  }, 100);
};

export const completeAllActiveRegions = async () => {
  if (state.activeRegionNames.size === 0) {
    alert("선택된 지역이 없습니다.");
    return;
  }

  if (!confirm(`현재 선택된 ${state.activeRegionNames.size}개 지역의 모든 항목을 완료 처리하시겠습니까?`)) return;

  const activeRegions = Array.from(state.activeRegionNames);
  const targetItems = state.mapData.items.filter(item => {
    const itemRegion = item.forceRegion || item.region || "알 수 없음";
    const normalizedRegion = state.reverseRegionMap[itemRegion] || itemRegion;
    return activeRegions.includes(normalizedRegion);
  });

  const targetIds = targetItems.map(item => String(item.id));
  await processBatchMarkers(targetIds, "complete", "일괄 완료 처리 중");
};

export const resetAllActiveRegions = async () => {
  if (state.activeRegionNames.size === 0) {
    alert("선택된 지역이 없습니다.");
    return;
  }

  if (!confirm(`현재 선택된 ${state.activeRegionNames.size}개 지역의 완료 기록을 초기화하시겠습니까?`)) return;

  const activeRegions = Array.from(state.activeRegionNames);
  const targetItems = state.mapData.items.filter(item => {
    const itemRegion = item.forceRegion || item.region || "알 수 없음";
    const normalizedRegion = state.reverseRegionMap[itemRegion] || itemRegion;
    return activeRegions.includes(normalizedRegion);
  });

  const targetIds = targetItems.map(item => String(item.id));
  await processBatchMarkers(targetIds, "reset", "일괄 초기화 중");
};

/**
 * Opens the region selection modal.
 */
export const openRegionModal = () => {
  const modal = document.getElementById("region-modal");
  if (!modal) return;

  const listContainer = document.getElementById("region-modal-list");
  if (!listContainer) return;

  listContainer.innerHTML = "";
  const sortedRegions = Array.from(state.uniqueRegions).sort((a, b) =>
    String(t(a)).localeCompare(String(t(b)), "ko"),
  );

  // Create temporary set for modal state
  const tempActiveRegions = new Set(state.activeRegionNames);

  sortedRegions.forEach(region => {
    const item = document.createElement("div");
    const isActive = tempActiveRegions.has(region);
    item.className = isActive ? "region-modal-item active" : "region-modal-item";

    // Accessibility
    item.setAttribute("role", "checkbox");
    item.setAttribute("aria-checked", isActive ? "true" : "false");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-label", t(String(region)));

    const checkbox = document.createElement("div");
    checkbox.className = "region-checkbox";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isActive;
    input.tabIndex = -1; // Managed by parent div

    const visual = document.createElement("div");
    visual.className = "checkbox-visual";
    visual.innerHTML = `
      <svg class="checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    checkbox.appendChild(input);
    checkbox.appendChild(visual);

    const name = document.createElement("span");
    name.className = "region-name";
    name.textContent = String(t(String(region)));

    item.appendChild(checkbox);
    item.appendChild(name);

    const toggle = () => {
      const isChecked = !input.checked;
      input.checked = isChecked;

      if (isChecked) {
        tempActiveRegions.add(region);
        item.classList.add("active");
        item.setAttribute("aria-checked", "true");
      } else {
        tempActiveRegions.delete(region);
        item.classList.remove("active");
        item.setAttribute("aria-checked", "false");
      }
    };

    item.addEventListener("click", toggle);

    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    listContainer.appendChild(item);
  });

  // Event handlers
  const closeBtn = document.getElementById("close-region-modal");
  const cancelBtn = document.getElementById("btn-modal-cancel");
  const applyBtn = document.getElementById("btn-modal-apply");
  const selectAllBtn = document.getElementById("btn-modal-select-all");
  const deselectAllBtn = document.getElementById("btn-modal-deselect-all");

  const closeModal = () => {
    modal.classList.add("hidden");
  };

  const applyChanges = () => {
    state.activeRegionNames.clear();
    tempActiveRegions.forEach(r => state.activeRegionNames.add(r));

    refreshSidebarLists();
    updateToggleButtonsState();
    updateMapVisibility();
    saveFilterState();
    closeModal();
  };

  // Remove existing listeners to prevent duplicates (simple approach)
  const newApplyBtn = applyBtn.cloneNode(true);
  applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
  newApplyBtn.addEventListener("click", applyChanges);

  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  newCloseBtn.addEventListener("click", closeModal);

  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
  newCancelBtn.addEventListener("click", closeModal);

  const newSelectAllBtn = selectAllBtn.cloneNode(true);
  selectAllBtn.parentNode.replaceChild(newSelectAllBtn, selectAllBtn);
  newSelectAllBtn.addEventListener("click", () => {
    const items = listContainer.querySelectorAll(".region-modal-item");
    items.forEach(item => {
      const input = item.querySelector("input");
      if (!input.checked) {
        /** @type {HTMLElement} */ (item).click(); // Trigger click to update state and UI
      }
    });
  });

  const newDeselectAllBtn = deselectAllBtn.cloneNode(true);
  deselectAllBtn.parentNode.replaceChild(newDeselectAllBtn, deselectAllBtn);
  newDeselectAllBtn.addEventListener("click", () => {
    const items = listContainer.querySelectorAll(".region-modal-item");
    items.forEach(item => {
      const input = item.querySelector("input");
      if (input.checked) {
        /** @type {HTMLElement} */ (item).click(); // Trigger click to update state and UI
      }
    });
  });

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  modal.classList.remove("hidden");
};
