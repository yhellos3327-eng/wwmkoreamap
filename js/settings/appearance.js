// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { applyTheme, getTheme } from "../theme.js";

/**
 * 메뉴 위치 클래스를 body에 적용합니다.
 * @param {string} position - 메뉴 위치 ('left', 'center', 'right').
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
 * 외형 설정 이벤트를 초기화하고 loadValues 함수가 포함된 객체를 반환합니다.
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
 * 현재 외형 설정을 상태 및 로컬 스토리지에 저장합니다.
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
