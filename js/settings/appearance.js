// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { applyTheme, getTheme } from "../theme.js";

/**
 * Applies the menu position class to the body.
 * @param {string} position - The menu position ('left', 'center', 'right').
 */
export const applyMenuPosition = (position) => {
  document.body.classList.remove(
    "menu-pos-left",
    "menu-pos-center",
    "menu-pos-right",
  );
  document.body.classList.add(`menu-pos-${position}`);
};

/**
 * Initializes appearance settings events and returns an object with a loadValues function.
 * @returns {{loadValues: Function}}
 */
export const initAppearanceSettings = () => {
  const regionColorInput = document.getElementById("region-line-color");
  const regionFillColorInput = document.getElementById("region-fill-color");
  const menuPositionSelect = document.getElementById("menu-position-select");
  const themeSelect = document.getElementById("theme-select");

  if (regionColorInput) {
    regionColorInput.addEventListener("input", (e) => {
      const valDisplay = document.getElementById("region-line-color-value");
      if (valDisplay)
        valDisplay.textContent = /** @type {HTMLInputElement} */ (
          e.target
        ).value.toUpperCase();
    });
  }

  if (regionFillColorInput) {
    regionFillColorInput.addEventListener("input", (e) => {
      const valDisplay = document.getElementById("region-fill-color-value");
      if (valDisplay)
        valDisplay.textContent = /** @type {HTMLInputElement} */ (
          e.target
        ).value.toUpperCase();
    });
  }

  if (menuPositionSelect) {
    /** @type {HTMLSelectElement} */ (menuPositionSelect).value =
      state.savedMenuPosition;
    applyMenuPosition(state.savedMenuPosition);

    menuPositionSelect.addEventListener("change", (e) => {
      const newPos = /** @type {HTMLSelectElement} */ (e.target).value;
      state.savedMenuPosition = newPos;
      localStorage.setItem("wwm_menu_position", newPos);
      applyMenuPosition(newPos);
    });
  }

  if (themeSelect) {
    themeSelect.addEventListener("change", (e) => {
      applyTheme(/** @type {HTMLSelectElement} */ (e.target).value);
    });
  }

  return {
    loadValues: () => {
      if (regionColorInput) {
        /** @type {HTMLInputElement} */ (regionColorInput).value =
          state.savedRegionColor;
        const valDisplay = document.getElementById("region-line-color-value");
        if (valDisplay)
          valDisplay.textContent = state.savedRegionColor.toUpperCase();
      }
      if (regionFillColorInput) {
        /** @type {HTMLInputElement} */ (regionFillColorInput).value =
          state.savedRegionFillColor;
        const valDisplay = document.getElementById("region-fill-color-value");
        if (valDisplay)
          valDisplay.textContent = state.savedRegionFillColor.toUpperCase();
      }
      if (themeSelect) {
        /** @type {HTMLSelectElement} */ (themeSelect).value = getTheme();
      }
    },
  };
};

/**
 * Saves the current appearance settings to state and local storage.
 */
export const saveAppearanceSettings = () => {
  const regionColorInput = document.getElementById("region-line-color");
  const regionFillColorInput = document.getElementById("region-fill-color");

  if (regionColorInput) {
    const newColor = /** @type {HTMLInputElement} */ (regionColorInput).value;
    setState("savedRegionColor", newColor);
    localStorage.setItem("wwm_region_color", newColor);
  }
  if (regionFillColorInput) {
    const newFillColor = /** @type {HTMLInputElement} */ (regionFillColorInput)
      .value;
    setState("savedRegionFillColor", newFillColor);
    localStorage.setItem("wwm_region_fill_color", newFillColor);
  }
};
