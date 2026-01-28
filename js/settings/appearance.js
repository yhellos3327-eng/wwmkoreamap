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

    menuPositionSelect.addEventListener("change", async (e) => {
      const newPos = /** @type {HTMLSelectElement} */ (e.target).value;
      state.savedMenuPosition = newPos;

      const { updateSettingWithTimestamp } = await import("../sync.js");
      updateSettingWithTimestamp("menuPosition", newPos);

      applyMenuPosition(newPos);
    });
  }

  if (themeSelect) {
    themeSelect.addEventListener("change", (e) => {
      applyTheme(/** @type {HTMLSelectElement} */(e.target).value);
    });
  }

  return {
    loadValues: async () => {
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
        /** @type {HTMLSelectElement} */ (themeSelect).value = await getTheme();
      }
    },
  };
};

/**
 * Saves the current appearance settings to state and local storage.
 */
export const saveAppearanceSettings = async () => {
  const regionColorInput = document.getElementById("region-line-color");
  const regionFillColorInput = document.getElementById("region-fill-color");
  const { updateSettingWithTimestamp } = await import("../sync.js");

  if (regionColorInput) {
    const newColor = /** @type {HTMLInputElement} */ (regionColorInput).value;
    setState("savedRegionColor", newColor);
    await updateSettingWithTimestamp("regionColor", newColor);
  }
  if (regionFillColorInput) {
    const newFillColor = /** @type {HTMLInputElement} */ (regionFillColorInput)
      .value;
    setState("savedRegionFillColor", newFillColor);
    await updateSettingWithTimestamp("regionFillColor", newFillColor);
  }
};
