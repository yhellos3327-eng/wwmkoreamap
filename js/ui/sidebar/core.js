// @ts-check
/// <reference path="../../types.d.ts" />
import { state } from "../../state.js";
import { EYE_OPEN_SVG_STYLED, EYE_OFF_SVG_STYLED } from "./constants.js";

/**
 * Toggles the sidebar open or closed.
 * @param {string} [action] - 'open' to open, otherwise toggles or closes based on current state (logic implies 'open' forces open, anything else forces close/collapsed).
 */
export const toggleSidebar = (action) => {
  const sidebar = document.getElementById("sidebar");
  const openBtn = document.getElementById("open-sidebar");

  if (!sidebar) return;

  if (action === "open") {
    sidebar.classList.add("open");
    sidebar.classList.remove("collapsed");
    document.body.classList.add("sidebar-open");
    if (openBtn) openBtn.classList.add("hidden-btn");
  } else {
    sidebar.classList.remove("open");
    sidebar.classList.add("collapsed");
    document.body.classList.remove("sidebar-open");
    if (openBtn) openBtn.classList.remove("hidden-btn");
  }

  setTimeout(() => {
    if (state.map) state.map.invalidateSize();
  }, 300);
};

/**
 * Updates the state of category and region toggle buttons in the sidebar.
 */
export const updateToggleButtonsState = () => {
  const btnToggleCat = document.getElementById("btn-toggle-cat");
  const btnToggleReg = document.getElementById("btn-toggle-reg");
  const validCategories = state.mapData.categories;

  if (btnToggleCat) {
    const allCatActive =
      validCategories.length > 0 &&
      validCategories.every((cat) => state.activeCategoryIds.has(cat.id));
    btnToggleCat.innerHTML = allCatActive
      ? `${EYE_OFF_SVG_STYLED} 모두 끄기`
      : `${EYE_OPEN_SVG_STYLED} 모두 켜기`;
    btnToggleCat.classList.toggle("off", !allCatActive);
  }
  if (btnToggleReg) {
    const allRegActive =
      state.activeRegionNames.size === state.uniqueRegions.size;
    btnToggleReg.innerHTML = allRegActive
      ? `${EYE_OFF_SVG_STYLED} 모두 끄기`
      : `${EYE_OPEN_SVG_STYLED} 모두 켜기`;
    btnToggleReg.classList.toggle("off", !allRegActive);
  }
};
