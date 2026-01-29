// @ts-check
/// <reference path="../../types.d.ts" />
import { state } from "../../state.js";
import { t } from "../../utils.js";
import { saveFilterState } from "../../data.js";
import { updateMapVisibility } from "../../map.js";
import { CATEGORY_GROUPS, EYE_OPEN_SVG, EYE_OFF_SVG } from "./constants.js";
import { updateToggleButtonsState } from "./core.js";
import { setAllRegions } from "./regions.js";

/**
 * Sets all categories to active or inactive.
 * @param {boolean} isActive - Whether to activate all categories.
 */
export const setAllCategories = (isActive) => {
  const catBtns = document.querySelectorAll("#category-list .cate-item");
  state.activeCategoryIds.clear();
  const validCategories = state.mapData.categories;

  if (isActive) {
    validCategories.forEach((c) => state.activeCategoryIds.add(c.id));
    catBtns.forEach((btn) => btn.classList.add("active"));
  } else {
    catBtns.forEach((btn) => btn.classList.remove("active"));
  }
  updateToggleButtonsState();
  updateMapVisibility();
  saveFilterState();
};

import { lazyLoader } from "../lazy-loader.js";

/**
 * Refreshes the category list in the sidebar.
 */
export const refreshCategoryList = () => {
  const categoryListEl = document.getElementById("category-list");
  if (!categoryListEl) return;
  categoryListEl.innerHTML = "";

  const validCategories = state.mapData.categories;

  for (const [groupKey, groupInfo] of Object.entries(CATEGORY_GROUPS)) {
    const groupDiv = document.createElement("div");
    groupDiv.className = "category-group";

    const groupTitle = document.createElement("h3");
    groupTitle.className = "group-name";

    const titleText = document.createElement("span");
    titleText.textContent = groupInfo.title;
    groupTitle.appendChild(titleText);

    const groupToggleBtn = document.createElement("button");
    groupToggleBtn.className = "group-toggle-btn";
    groupToggleBtn.title = `${groupInfo.title} 모두 켜기/끄기`;
    groupToggleBtn.dataset.group = groupKey;

    const groupCategoryIds = groupInfo.ids.filter((id) =>
      validCategories.some((c) => c.id === id),
    );
    const allGroupActive =
      groupCategoryIds.length > 0 &&
      groupCategoryIds.every((id) => state.activeCategoryIds.has(id));

    groupToggleBtn.innerHTML = allGroupActive ? EYE_OFF_SVG : EYE_OPEN_SVG;
    groupToggleBtn.classList.toggle("all-active", allGroupActive);

    groupToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentGroupIds = groupInfo.ids.filter((id) =>
        validCategories.some((c) => c.id === id),
      );
      const currentAllActive = currentGroupIds.every((id) =>
        state.activeCategoryIds.has(id),
      );

      if (currentAllActive) {
        currentGroupIds.forEach((id) => state.activeCategoryIds.delete(id));
      } else {
        currentGroupIds.forEach((id) => state.activeCategoryIds.add(id));
        if (state.activeRegionNames.size === 0) setAllRegions(true);
      }

      const catBtns = groupDiv.querySelectorAll(".cate-item");
      catBtns.forEach((btn) => {
        const catId = /** @type {HTMLElement} */ (btn).dataset.id;
        if (catId) {
          btn.classList.toggle(
            "active",
            state.activeCategoryIds.has(parseInt(catId) || catId),
          );
        }
      });

      const nowAllActive = currentGroupIds.every((id) =>
        state.activeCategoryIds.has(id),
      );
      groupToggleBtn.innerHTML = nowAllActive ? EYE_OFF_SVG : EYE_OPEN_SVG;
      groupToggleBtn.classList.toggle("all-active", nowAllActive);

      updateToggleButtonsState();
      updateMapVisibility();
      saveFilterState();
    });

    groupTitle.appendChild(groupToggleBtn);
    groupDiv.appendChild(groupTitle);

    const cateListDiv = document.createElement("div");
    cateListDiv.className = "cate-list";

    const groupCategories = validCategories.filter((cat) =>
      groupInfo.ids.includes(cat.id),
    );
    groupCategories.sort((a, b) =>
      String(t(a.name)).localeCompare(String(t(b.name)), "ko"),
    );

    groupCategories.forEach((cat) => {
      const btn = document.createElement("div");
      btn.className = state.activeCategoryIds.has(cat.id)
        ? "cate-item active"
        : "cate-item";
      btn.dataset.id = String(cat.id);

      const items = state.itemsByCategory[cat.id] || [];
      const count = items.length;

      let transCount = 0;
      items.forEach((i) => {
        if (
          i.isTranslated ||
          state.koDict[i.name] ||
          state.koDict[i.name.trim()]
        ) {
          transCount++;
        }
      });

      const percent = count > 0 ? Math.round((transCount / count) * 100) : 0;
      let progressClass = "";
      if (percent === 100) progressClass = "done";
      else if (percent >= 70) progressClass = "high";
      else if (percent >= 30) progressClass = "mid";
      else if (percent > 0) progressClass = "low";

      const placeholder =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

      btn.innerHTML = `
                <span class="cate-icon"><img data-src="${cat.image}" src="${placeholder}" class="lazy-load" alt=""></span>
                <div class="cate-info">
                    <div class="cate-name"><span>${t(cat.name)}</span></div>
                    <div class="cate-meta">
                        <span class="cate-count">${count}</span>
                        <span class="cate-trans-stat ${progressClass}">${percent}% 한글화</span>
                    </div>
                </div>
            `;

      const completeBtn = btn.querySelector(".cate-complete-btn");
      if (completeBtn) {
        completeBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const catName = t(cat.name);
          if (confirm(`${catName} 카테고리의 모든 항목을 완료 처리하시겠습니까?`)) {
            const { triggerSync } = await import("../../sync.js");
            const { updateSinglePixiMarker } = await import("../../map/pixiOverlay/overlayCore.js");
            const { primaryDb } = await import("../../storage/db.js");

            const catItems = state.itemsByCategory[cat.id] || [];
            const catMarkerIds = catItems.map(item => String(item.id));
            const completedAt = Date.now();
            let changed = false;

            catMarkerIds.forEach(id => {
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

              catMarkerIds.forEach((id) => {
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
              alert(`${catName} 카테고리 완료 처리가 끝났습니다.`);
            } else {
              alert("이미 모든 항목이 완료되어 있습니다.");
            }
          }
        });
      }

      btn.addEventListener("mouseenter", () => {
        const nameWrapper = /** @type {HTMLElement} */ (
          btn.querySelector(".cate-name")
        );
        if (nameWrapper) {
          const nameSpan = /** @type {HTMLElement} */ (
            nameWrapper.querySelector("span")
          );
          if (nameSpan) {
            const overflow = nameWrapper.scrollWidth - nameWrapper.clientWidth;
            if (overflow > 0) {
              nameSpan.style.setProperty(
                "--scroll-dist",
                `-${overflow + 10}px`,
              );
              nameWrapper.classList.add("is-long");
            } else {
              nameWrapper.classList.remove("is-long");
            }
          }
        }
      });

      btn.addEventListener("mouseleave", () => {
        const nameWrapper = btn.querySelector(".cate-name");
        if (nameWrapper) {
          nameWrapper.classList.remove("is-long");
        }
      });

      btn.addEventListener("click", () => {
        if (state.activeCategoryIds.has(cat.id)) {
          state.activeCategoryIds.delete(cat.id);
          btn.classList.remove("active");
        } else {
          state.activeCategoryIds.add(cat.id);
          btn.classList.add("active");
          if (state.activeRegionNames.size === 0) setAllRegions(true);
        }
        updateMapVisibility();
        updateToggleButtonsState();
        saveFilterState();
      });
      cateListDiv.appendChild(btn);
    });

    if (groupCategories.length > 0) {
      groupDiv.appendChild(cateListDiv);
      categoryListEl.appendChild(groupDiv);
    }
  }

  updateToggleButtonsState();

  lazyLoader.observeAll(".lazy-load", categoryListEl);
};

export const completeAllActiveCategories = async () => {
  if (state.activeCategoryIds.size === 0) {
    alert("선택된 카테고리가 없습니다.");
    return;
  }

  if (!confirm(`현재 선택된 ${state.activeCategoryIds.size}개 카테고리의 모든 항목을 완료 처리하시겠습니까?`)) return;

  const { triggerSync } = await import("../../sync.js");
  const { updateSinglePixiMarker } = await import("../../map/pixiOverlay/overlayCore.js");
  const { primaryDb } = await import("../../storage/db.js");

  const activeCategoryIds = Array.from(state.activeCategoryIds);
  const targetItems = state.mapData.items.filter(item => activeCategoryIds.includes(item.category));

  const completedAt = Date.now();
  let changed = false;
  const changedIds = [];

  targetItems.forEach(item => {
    const id = String(item.id);
    if (!state.completedList.find(c => String(c.id) === id)) {
      state.completedList.push({ id, completedAt });
      changed = true;
      changedIds.push(id);
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

    changedIds.forEach((id) => {
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
    alert("완료 처리가 끝났습니다.");
  } else {
    alert("이미 모든 항목이 완료되어 있습니다.");
  }
};

export const resetAllActiveCategories = async () => {
  if (state.activeCategoryIds.size === 0) {
    alert("선택된 카테고리가 없습니다.");
    return;
  }

  if (!confirm(`현재 선택된 ${state.activeCategoryIds.size}개 카테고리의 완료 기록을 초기화하시겠습니까?`)) return;

  const { triggerSync } = await import("../../sync.js");
  const { updateSinglePixiMarker } = await import("../../map/pixiOverlay/overlayCore.js");
  const { primaryDb } = await import("../../storage/db.js");

  const activeCategoryIds = Array.from(state.activeCategoryIds);
  const targetItems = state.mapData.items.filter(item => activeCategoryIds.includes(item.category));
  const targetIds = new Set(targetItems.map(i => String(i.id)));

  const initialLength = state.completedList.length;
  state.completedList = state.completedList.filter(item => !targetIds.has(String(item.id)));

  if (state.completedList.length !== initialLength) {
    try {
      await primaryDb.set("completedList", state.completedList);
      triggerSync();
    } catch (error) {
      console.error("Failed to save completedList:", error);
      alert("저장 중 오류가 발생했습니다.");
      return;
    }

    targetIds.forEach((id) => {
      const target = state.allMarkers.get(id) || state.allMarkers.get(Number(id));
      if (target && target.marker) {
        if (target.marker._icon) target.marker._icon.classList.remove("completed-marker");
        if (target.marker.options.icon?.options) {
          target.marker.options.icon.options.className = target.marker.options.icon.options.className.replace(" completed-marker", "");
        }
      }
      updateSinglePixiMarker(id);
    });

    updateMapVisibility();
    alert("초기화가 완료되었습니다.");
  } else {
    alert("초기화할 완료 기록이 없습니다.");
  }
};
