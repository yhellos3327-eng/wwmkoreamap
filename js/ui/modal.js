// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";

import { t } from "../utils.js";
import { jumpToId } from "./navigation.js";

/**
 * @typedef {import("../data/processors.js").MapItem} MapItem
 */

/**
 * Opens the related items modal for a category.
 * @param {string} catId - The category ID.
 */
export const openRelatedModal = (catId) => {
  const modal = document.getElementById("related-modal");
  const title = document.getElementById("modal-title");
  const listEl = document.getElementById("modal-list");
  const input = /** @type {HTMLInputElement} */ (
    document.getElementById("modal-search-input")
  );
  if (title) title.innerText = `${t(catId)} 전체 목록`;
  if (input) input.value = "";
  if (listEl) listEl.innerHTML = "";
  const currentModalList = Array.from(state.allMarkers.values()).filter(
    (m) => m.category === catId,
  );
  setState("currentModalList", currentModalList);
  renderModalList(currentModalList);
  if (modal) modal.classList.remove("hidden");
  if (input) input.focus();
};

/**
 * Closes the related items modal.
 */
export const closeModal = () => {
  const modal = document.getElementById("related-modal");
  if (modal) modal.classList.add("hidden");
};

/**
 * Renders the list of items in the modal.
 * @param {MapItem[]} items - The items to render.
 */
export const renderModalList = (items) => {
  const listEl = document.getElementById("modal-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  if (items.length === 0) {
    listEl.innerHTML =
      '<li style="padding:15px; text-align:center; color:#666;">결과가 없습니다.</li>';
    return;
  }
  const currComp = state.completedList || [];
  items.forEach((m) => {
    const displayRegion = t(m.forceRegion || m.region);
    let displayName = String(t(m.originalName || m.name));
    if (displayName)
      displayName = displayName.replace(/{region}/g, String(displayRegion));
    const isDone = currComp.some(
      (c) => (typeof c === "object" ? c.id : c) === m.id,
    );
    const statusHtml = isDone
      ? '<span class="modal-item-status">완료</span>'
      : "";

    const catObj = state.mapData.categories.find((c) => c.id === m.category);
    const iconUrl = catObj ? catObj.image : "./icons/17310010088.png";

    const li = document.createElement("li");
    li.className = "modal-list-item";
    li.innerHTML = `
        <img src="${iconUrl}" class="modal-item-icon" alt="icon">
        <div class="modal-item-info">
            <div class="modal-item-name">${displayName}</div>
            <div class="modal-item-region">${displayRegion}</div>
        </div>
        ${statusHtml}
    `;
    li.onclick = () => {
      jumpToId(m.id);
      closeModal();
    };
    listEl.appendChild(li);
  });
};

export const renderContributionModal = () => {
  const githubModalTitle = document.getElementById("github-modal-title");
  const githubModalDesc = document.getElementById("github-modal-desc");
  const linksContainer = document.getElementById("github-modal-links");
  const guideContainer = document.getElementById(
    "contribution-guide-container",
  );

  if (
    !githubModalTitle ||
    !githubModalDesc ||
    !linksContainer ||
    !guideContainer
  )
    return;

  githubModalTitle.textContent = String(t("contribute_title"));
  githubModalDesc.innerHTML = String(t("contribute_description")).replace(
    /\n/g,
    "<br>",
  );

  linksContainer.innerHTML = "";

  guideContainer.innerHTML = `
        <h1 style="margin-bottom: 15px; margin-left: 5px; font-size: 1.5rem;">${t("guide_trans_title")}</h1>
        <div class="guide-steps">${t("guide_trans_steps")}</div>
    `;
};
