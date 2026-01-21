// @ts-check
/// <reference path="../../types.d.ts" />
export { CATEGORY_GROUPS, EYE_OPEN_SVG, EYE_OFF_SVG } from "./constants.js";
export { toggleSidebar, updateToggleButtonsState } from "./core.js";
export { setAllCategories, refreshCategoryList } from "./categories.js";
export {
  setAllRegions,
  refreshSidebarLists,
  injectSetAllCategories,
} from "./regions.js";
export { renderFavorites } from "./favorites.js";
import { setAllCategories } from "./categories.js";
import { injectSetAllCategories } from "./regions.js";

injectSetAllCategories(setAllCategories);

document.addEventListener("click", function (e) {
  const el = /** @type {HTMLElement} */ (e.target);
  if (el.classList && el.classList.contains("spoiler")) {
    el.classList.toggle("revealed");
  }
});
