// @ts-check
/// <reference path="../../types.d.ts" />
import { state } from "../../state.js";
import { t } from "../../utils.js";
import { toggleSidebar } from "./core.js";

/**
 * @typedef {import("../../data/processors.js").MapItem} MapItem
 */

/**
 * Renders the favorites list in the sidebar.
 */
export const renderFavorites = () => {
  let favListEl = document.getElementById("favorite-list");

  if (!favListEl) {
    let favTab = document.getElementById("favorite-tab");
    if (!favTab) {
      const filterContainer = document.querySelector(".filter-container");
      if (filterContainer) {
        console.warn("favorite-tab 요소가 없어 복구합니다.");
        favTab = document.createElement("div");
        favTab.id = "favorite-tab";
        favTab.className = "tab-content";
        filterContainer.appendChild(favTab);
      } else {
        console.error("filter-container 요소도 없어 복구할 수 없습니다.");
        return;
      }
    }

    if (favTab) {
      console.warn("favorite-list 요소가 없어 복구합니다.");
      favListEl = document.createElement("div");
      favListEl.id = "favorite-list";
      favListEl.className = "favorite-list";
      favTab.appendChild(favListEl);
    }
  }

  favListEl.innerHTML = "";
  console.log("[Favorites] Rendering favorites:", state.favorites);

  if (state.favorites.length === 0) {
    favListEl.innerHTML =
      '<p class="empty-msg">즐겨찾기한 항목이 없습니다.</p>';
    return;
  }
  state.favorites.forEach((favId) => {
    const item = /** @type {MapItem | undefined} */ (
      state.mapData.items.find((i) => String(i.id) === String(favId))
    );
    if (item) {
      const div = document.createElement("div");
      div.className = "fav-item";
      const rReg = item.region || "알 수 없음";

      const iconWrapper = document.createElement("div");
      iconWrapper.className = "fav-icon-wrapper";
      iconWrapper.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>`;

      const infoDiv = document.createElement("div");
      infoDiv.className = "fav-info";
      infoDiv.innerHTML = `
                <div class="fav-name">${t(item.name)}</div>
                <div class="fav-meta">
                    <span class="fav-region">${rReg}</span>
                    <span class="fav-category">${t(item.category)}</span>
                </div>`;

      div.appendChild(iconWrapper);
      div.appendChild(infoDiv);

      div.addEventListener("click", async () => {
        const { jumpToId } = await import("../navigation.js");
        jumpToId(item.id);
        if (window.innerWidth <= 768) toggleSidebar("close");
      });
      favListEl.appendChild(div);
    }
  });
};
