// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { MAP_CONFIGS } from "../config.js";
import { loadMapData } from "../data.js";
import { setUrlParam, removeUrlParam } from "../urlHandler.js";

/**
 * @typedef {import("../config.js").MapConfig} MapConfig
 */

/**
 * Handles map selection from dropdown.
 * @param {string} key - Map key.
 * @param {MapConfig} config - Map configuration.
 * @param {HTMLElement} customSelect - Custom select element.
 * @param {HTMLElement} optionsContainer - Options container element.
 * @param {HTMLElement|null} selectedText - Selected text element.
 * @param {HTMLElement} optionDiv - Option element.
 */
export const handleMapSelection = async (
  key,
  config,
  customSelect,
  optionsContainer,
  selectedText,
  optionDiv,
) => {
  if (state.currentMapKey === key) {
    customSelect.classList.remove("open");
    return;
  }

  setState("currentMapKey", key);
  if (selectedText) selectedText.textContent = config.name;

  // URL 파라미터에 맵 키를 저장하여 새로고침 시에도 유지되도록 함
  if (key === "qinghe") {
    removeUrlParam("map");
  } else {
    setUrlParam("map", key);
  }

  const allOptions = optionsContainer.querySelectorAll(".custom-option");
  allOptions.forEach((opt) => opt.classList.remove("selected"));
  optionDiv.classList.add("selected");

  customSelect.classList.remove("open");

  syncDropdowns(key, config.name);

  await loadMapData(state.currentMapKey);
};

/**
 * Syncs dropdowns across the UI.
 * @param {string} key - Map key.
 * @param {string} name - Map name.
 */
const syncDropdowns = (key, name) => {
  const selectors = ["custom-map-select", "sidebar-map-select"];
  selectors.forEach((selectorId) => {
    const select = document.getElementById(selectorId);
    if (!select) return;

    const selectedText = select.querySelector(".selected-text");
    if (selectedText) selectedText.textContent = name;

    const options = select.querySelectorAll(".custom-option");
    options.forEach((opt) => {
      const el = /** @type {HTMLElement} */ (opt);
      el.classList.toggle("selected", el.dataset.value === key);
    });
  });
};

/**
 * Creates a dropdown option element.
 * @param {string} key - Map key.
 * @param {MapConfig} config - Map configuration.
 * @param {HTMLElement} customSelect - Custom select element.
 * @param {HTMLElement} optionsContainer - Options container element.
 * @param {HTMLElement|null} selectedText - Selected text element.
 * @returns {HTMLElement} The option element.
 */
export const createDropdownOption = (
  key,
  config,
  customSelect,
  optionsContainer,
  selectedText,
) => {
  const optionDiv = document.createElement("div");
  optionDiv.className = `custom-option ${key === state.currentMapKey ? "selected" : ""}`;
  optionDiv.dataset.value = key;
  optionDiv.textContent = config.name;

  optionDiv.addEventListener("click", (e) => {
    e.stopPropagation();
    handleMapSelection(
      key,
      config,
      customSelect,
      optionsContainer,
      selectedText,
      optionDiv,
    );
  });

  return optionDiv;
};

/**
 * Sets up dropdown events.
 * @param {HTMLElement} customSelect - Custom select element.
 * @param {HTMLElement} trigger - Trigger element.
 */
export const setupDropdownEvents = (customSelect, trigger) => {
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    customSelect.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!customSelect.contains(/** @type {Node} */ (e.target))) {
      customSelect.classList.remove("open");
    }
  });
};

/**
 * Initializes the main map selection dropdown.
 */
export const initCustomDropdown = () => {
  const customSelect = document.getElementById("custom-map-select");
  if (!customSelect) return;

  const trigger = /** @type {HTMLElement} */ (
    customSelect.querySelector(".select-trigger")
  );
  const optionsContainer = /** @type {HTMLElement} */ (
    customSelect.querySelector(".select-options")
  );
  const selectedText = /** @type {HTMLElement} */ (
    customSelect.querySelector(".selected-text")
  );

  optionsContainer.innerHTML = "";

  Object.keys(MAP_CONFIGS).forEach((key) => {
    const config = MAP_CONFIGS[key];
    const optionDiv = createDropdownOption(
      key,
      config,
      customSelect,
      optionsContainer,
      selectedText,
    );
    optionsContainer.appendChild(optionDiv);
  });

  if (MAP_CONFIGS[state.currentMapKey] && selectedText) {
    selectedText.textContent = MAP_CONFIGS[state.currentMapKey].name;
  }

  setupDropdownEvents(customSelect, trigger);

  initSidebarDropdown();
};

/**
 * Initializes the sidebar map selection dropdown.
 */
export const initSidebarDropdown = () => {
  const sidebarSelect = document.getElementById("sidebar-map-select");
  if (!sidebarSelect) return;

  const trigger = /** @type {HTMLElement} */ (
    sidebarSelect.querySelector(".select-trigger")
  );
  const optionsContainer = /** @type {HTMLElement} */ (
    sidebarSelect.querySelector(".select-options")
  );
  const selectedText = /** @type {HTMLElement} */ (
    sidebarSelect.querySelector(".selected-text")
  );

  optionsContainer.innerHTML = "";

  Object.keys(MAP_CONFIGS).forEach((key) => {
    const config = MAP_CONFIGS[key];
    const optionDiv = createDropdownOption(
      key,
      config,
      sidebarSelect,
      optionsContainer,
      selectedText,
    );
    optionsContainer.appendChild(optionDiv);
  });

  if (MAP_CONFIGS[state.currentMapKey] && selectedText) {
    selectedText.textContent = MAP_CONFIGS[state.currentMapKey].name;
  }

  setupDropdownEvents(sidebarSelect, trigger);

  const sidebarRouteBtn = document.getElementById("sidebar-route-toggle");
  if (sidebarRouteBtn) {
    sidebarRouteBtn.addEventListener("click", async () => {
      const { toggleRouteMode } = await import("../route/index.js");
      const isActive = toggleRouteMode();
      sidebarRouteBtn.classList.toggle("active", isActive);
      const topRouteBtn = document.getElementById("route-mode-toggle");
      if (topRouteBtn) topRouteBtn.classList.toggle("active", isActive);
    });
  }
};
