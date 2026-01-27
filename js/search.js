// @ts-check
/// <reference path="./types.d.ts" />
/**
 * Search Module - 검색 기능 모듈
 * 검색창 아래 임베드 드롭다운으로 지역/카테고리 결과 표시
 * 카테고리는 지역별로 분리하여 표시
 */
import { state } from "./state.js";
import { t } from "./utils.js";
import { saveFilterState } from "./data.js";
import { renderMapDataAndMarkers } from "./map.js";
import { updateToggleButtonsState } from "./ui.js";
import Fuse from "https://esm.run/fuse.js@7.1.0";
import { debounce } from "https://esm.run/lodash-es@4.17.22";

/**
 * @typedef {import("./data/processors.js").MapItem} MapItem
 */

const SVG_ICONS = {
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        <line x1="8" y1="2" x2="8" y2="18"/>
        <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>`,
  category: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
    </svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>`,
  marker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
    </svg>`,
};

// Custom debounce removed in favor of lodash debounce imported above

/**
 * Gets category item counts by region.
 * @param {number|string} categoryId
 * @returns {Object.<string, number>}
 */
const getCategoryItemsByRegion = (categoryId) => {
  /** @type {Object.<string, number>} */
  const regionCounts = {};
  state.mapData.items.forEach((item) => {
    if (item.category === categoryId) {
      const rawRegion = item.forceRegion || item.region || "알 수 없음";
      const region = state.reverseRegionMap[rawRegion] || rawRegion;
      regionCounts[region] ??= 0;
      regionCounts[region]++;
    }
  });
  return regionCounts;
};

/** @type {Set<string|number>} */
let expandedCategories = new Set();

/**
 * Renders search results.
 * @param {string} term - The search term.
 * @param {HTMLElement} searchInput - The search input element.
 * @param {HTMLElement} searchResults - The search results container.
 */
const renderSearchResults = (term, searchInput, searchResults) => {
  if (!term || term.length < 1) {
    searchResults.classList.add("hidden");
    searchResults.style.display = "none";
    resetMarkerOpacity();
    expandedCategories.clear();
    return;
  }

  // Fuse.js options for fuzzy search
  const fuseOptions = {
    includeScore: true,
    threshold: 0.3,
    keys: ["name", "id", "translatedName"],
  };

  // Prepare data for Fuse
  const regionData = Array.from(state.uniqueRegions).map((r) => ({
    id: r,
    name: r,
    translatedName: t(r),
    type: "region",
  }));

  const categoryData = (state.mapData?.categories ?? []).map((c) => ({
    id: c.id,
    name: c.name || c.id,
    translatedName: t(c.name || c.id),
    type: "category",
  }));

  const regionFuse = new Fuse(regionData, fuseOptions);
  const categoryFuse = new Fuse(categoryData, fuseOptions);

  const regionResults = regionFuse.search(term).map((r) => r.item.id);
  const categoryResults = categoryFuse.search(term).map((r) => r.item);

  const matchedRegions = regionResults.slice(0, 5);
  const matchedCategories = categoryResults.slice(0, 8);

  if (matchedRegions.length === 0 && matchedCategories.length === 0) {
    searchResults.innerHTML = `
            <div class="search-no-results">
                <div class="no-results-icon">${SVG_ICONS.search}</div>
                <span>검색 결과가 없습니다</span>
            </div>
        `;
    showSearchResults(searchResults);
    return;
  }

  let html = "";

  if (matchedRegions.length > 0) {
    html += `
            <div class="search-section">
                <div class="search-section-header">
                    <span class="section-icon">${SVG_ICONS.map}</span>
                    <span class="section-label">지역</span>
                    <span class="section-count">${matchedRegions.length}</span>
                </div>
                <div class="search-section-items">
        `;

    matchedRegions.forEach((region) => {
      const markerCount = state.mapData.items.filter((item) => {
        const rawRegion = item.forceRegion || item.region || "알 수 없음";
        const normalizedRegion = state.reverseRegionMap[rawRegion] || rawRegion;
        return normalizedRegion === region;
      }).length;
      const isActive = state.activeRegionNames.has(region);

      html += `
                <div class="search-embed-item cate-item ${isActive ? "active" : ""}" data-type="region" data-region="${region}">
                    <div class="cate-icon region-svg-icon">
                        ${SVG_ICONS.marker}
                    </div>
                    <div class="cate-info">
                        <span class="cate-name">${t(region)}</span>
                        <div class="cate-meta">
                            <span class="cate-count">${markerCount}개</span>
                        </div>
                    </div>
                    <span class="search-type-badge region-badge">지역</span>
                </div>
            `;
    });

    html += "</div></div>";
  }

  if (matchedCategories.length > 0) {
    matchedCategories.forEach((cat) => {
      const catId = cat.id;
      const catName = t(cat.name || cat.id);
      const iconPath = `icons/${catId}.png`;
      const regionCounts = getCategoryItemsByRegion(catId);
      const regions = Object.keys(regionCounts).sort(
        (a, b) => regionCounts[b] - regionCounts[a],
      );
      const totalCount = Object.values(regionCounts).reduce(
        (sum, c) => sum + c,
        0,
      );

      if (totalCount === 0) return;

      const isExpanded = expandedCategories.has(catId);
      const displayRegions = isExpanded ? regions : regions.slice(0, 6);
      const hasMore = regions.length > 6 && !isExpanded;

      html += `
                <div class="search-section">
                    <div class="search-section-header category-header">
                        <div class="category-header-icon">
                            <img src="${iconPath}" onerror="this.src='icons/17310010015.png'" alt="">
                        </div>
                        <span class="section-label">${catName}</span>
                        <span class="section-count">${totalCount}개</span>
                    </div>
                    <div class="search-section-items">
            `;

      displayRegions.forEach((region) => {
        const count = regionCounts[region];
        const isActive =
          state.activeCategoryIds.has(catId) &&
          state.activeRegionNames.has(region);

        html += `
                    <div class="search-embed-item cate-item region-category-item ${isActive ? "active" : ""}" 
                         data-type="category-region" 
                         data-category="${catId}" 
                         data-region="${region}">
                        <div class="cate-icon small-icon">
                            <img src="${iconPath}" onerror="this.src='icons/17310010015.png'" alt="">
                        </div>
                        <div class="cate-info">
                            <span class="cate-name">${count}개 ${catName}</span>
                        </div>
                        <span class="cate-region-tag">${t(region)}</span>
                    </div>
                `;
      });

      if (hasMore) {
        const remainingCount = regions.length - 6;
        html += `
                    <div class="search-more-regions" data-action="expand" data-category="${catId}">
                        +${remainingCount}개 지역 더보기
                    </div>
                `;
      }

      html += "</div></div>";
    });
  }

  searchResults.innerHTML = html;

  searchResults.querySelectorAll(".search-embed-item").forEach((item) => {
    item.addEventListener("click", () => {
      const el = /** @type {HTMLElement} */ (item);
      const type = el.dataset.type;

      if (type === "region") {
        const region = el.dataset.region;
        handleRegionClick(region, searchInput, searchResults);
      } else if (type === "category-region") {
        const categoryId = el.dataset.category;
        const region = el.dataset.region;
        handleCategoryRegionClick(
          categoryId,
          region,
          searchInput,
          searchResults,
        );
      }
    });
  });

  searchResults.querySelectorAll(".search-more-regions").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = /** @type {HTMLElement} */ (btn);
      const catId = el.dataset.category;
      expandedCategories.add(catId);

      const term = /** @type {HTMLInputElement} */ (searchInput).value
        .trim()
        .toLowerCase();
      renderSearchResults(term, searchInput, searchResults);

      /** @type {HTMLInputElement} */ (searchInput).focus();
    });
  });

  showSearchResults(searchResults);
  highlightMatchingMarkers(term);
};

/**
 * Shows the search results container.
 * @param {HTMLElement} searchResults - The search results container.
 */
const showSearchResults = (searchResults) => {
  searchResults.classList.remove("hidden");
  searchResults.style.display = "block";
  searchResults.style.visibility = "visible";
  searchResults.style.opacity = "1";
  searchResults.style.pointerEvents = "auto";
};

/**
 * Hides the search results container.
 * @param {HTMLElement} searchResults - The search results container.
 */
const hideSearchResults = (searchResults) => {
  searchResults.classList.add("hidden");
  searchResults.style.display = "none";
  searchResults.style.visibility = "hidden";
  searchResults.style.opacity = "0";
  searchResults.style.pointerEvents = "none";
};

/**
 * Restores all filters to their default active state.
 */
const restoreAllFilters = () => {
  state.activeCategoryIds.clear();
  state.mapData?.categories?.forEach((cat) => {
    state.activeCategoryIds.add(cat.id);
  });

  state.activeRegionNames.clear();
  state.uniqueRegions.forEach((region) => {
    state.activeRegionNames.add(region);
  });

  const catBtns = document.querySelectorAll("#category-list .cate-item");
  catBtns.forEach((btn) => btn.classList.add("active"));

  const regBtns = document.querySelectorAll("#region-list .cate-item");
  regBtns.forEach((btn) => btn.classList.add("active"));

  updateToggleButtonsState();
  renderMapDataAndMarkers();
  saveFilterState();
};

/**
 * Resets marker opacity to full visibility.
 */
const resetMarkerOpacity = () => {
  state.allMarkers.forEach((m) => {
    if (m.marker) m.marker.setOpacity(1);
    else if (m.sprite) m.sprite.alpha = 1;
  });

  state.pixiOverlay?.redraw();
};

/**
 * Highlights markers matching the search term.
 * @param {string} term - The search term.
 */
const highlightMatchingMarkers = (term) => {
  if (!term) {
    resetMarkerOpacity();
    return;
  }

  state.allMarkers.forEach((m) => {
    const regionName = String(t(m.region)).toLowerCase();
    const categoryName = String(t(m.category)).toLowerCase();
    const name = m.name.toLowerCase();
    const translatedName = String(t(m.name)).toLowerCase();

    const isMatch =
      name.includes(term) ||
      translatedName.includes(term) ||
      regionName.includes(term) ||
      categoryName.includes(term);

    if (m.marker) {
      m.marker.setOpacity(isMatch ? 1 : 0.15);
    } else if (m.sprite) {
      m.sprite.alpha = isMatch ? 1 : 0.15;
    }
  });

  state.pixiOverlay?.redraw();
};

/**
 * Handles a region click in search results.
 * @param {string} region - The region name.
 * @param {HTMLElement} searchInput - The search input element.
 * @param {HTMLElement} searchResults - The search results container.
 */
const handleRegionClick = (region, searchInput, searchResults) => {
  /** @type {HTMLInputElement} */ (searchInput).value = String(t(region));
  hideSearchResults(searchResults);
  resetMarkerOpacity();

  state.activeRegionNames.clear();
  state.activeRegionNames.add(region);

  const regBtns = document.querySelectorAll("#region-list .cate-item");
  regBtns.forEach((btn) => {
    if (/** @type {HTMLElement} */ (btn).dataset.region === region) {
      btn.classList.add("active");
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      btn.classList.remove("active");
    }
  });

  updateToggleButtonsState();
  renderMapDataAndMarkers();
  saveFilterState();

  const meta = state.regionMetaInfo[region];
  if (meta) {
    state.map.flyTo([meta.lat, meta.lng], meta.zoom, {
      animate: true,
      duration: 1.0,
    });
  }
};

/**
 * Handles a category-region click in search results.
 * @param {string|number} categoryId - The category ID.
 * @param {string} region - The region name.
 * @param {HTMLElement} searchInput - The search input element.
 * @param {HTMLElement} searchResults - The search results container.
 */
const handleCategoryRegionClick = (
  categoryId,
  region,
  searchInput,
  searchResults,
) => {
  const catName = t(categoryId);
  const regionName = t(region);
  /** @type {HTMLInputElement} */ (searchInput).value =
    `${catName} - ${regionName}`;
  hideSearchResults(searchResults);
  resetMarkerOpacity();

  state.activeCategoryIds.clear();
  state.activeCategoryIds.add(categoryId);

  state.activeRegionNames.clear();
  state.activeRegionNames.add(region);

  const catBtns = document.querySelectorAll("#category-list .cate-item");
  catBtns.forEach((btn) => {
    if (/** @type {HTMLElement} */ (btn).dataset.id === categoryId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const regBtns = document.querySelectorAll("#region-list .cate-item");
  regBtns.forEach((btn) => {
    if (/** @type {HTMLElement} */ (btn).dataset.region === region) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  updateToggleButtonsState();
  renderMapDataAndMarkers();
  saveFilterState();

  const meta = state.regionMetaInfo[region];
  if (meta) {
    state.map.flyTo([meta.lat, meta.lng], meta.zoom, {
      animate: true,
      duration: 1.0,
    });
  }
};

/**
 * Initializes the main search functionality.
 */
export const initSearch = () => {
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");

  console.log("[Search] Initializing...", { searchInput, searchResults });

  if (!searchInput || !searchResults) {
    console.error("[Search] Search elements not found!");
    return;
  }

  const debouncedSearch = debounce((term) => {
    renderSearchResults(
      term,
      /** @type {HTMLInputElement} */(searchInput),
      searchResults,
    );
  }, 200);

  searchInput.addEventListener("input", (e) => {
    const term = /** @type {HTMLInputElement} */ (e.target).value
      .trim()
      .toLowerCase();
    console.log("[Search] Input term:", term);

    if (term === "") {
      debouncedSearch.cancel();
      hideSearchResults(searchResults);
      resetMarkerOpacity();
      expandedCategories.clear();

      restoreAllFilters();
      return;
    }

    debouncedSearch(term);
  });

  let isClickInsideResults = false;

  searchResults.addEventListener("mousedown", () => {
    isClickInsideResults = true;
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (!isClickInsideResults) {
        hideSearchResults(searchResults);
      }
      isClickInsideResults = false;
    }, 150);
  });

  searchInput.addEventListener("focus", () => {
    const term = /** @type {HTMLInputElement} */ (searchInput).value
      .trim()
      .toLowerCase();
    if (term.length >= 1) {
      renderSearchResults(
        term,
        /** @type {HTMLInputElement} */(searchInput),
        searchResults,
      );
    }
  });
};

/**
 * Initializes modal search functionality.
 * @param {Function} renderModalList - The function to render the modal list.
 */
export const initModalSearch = (renderModalList) => {
  const modalSearchInput = document.getElementById("modal-search-input");
  if (modalSearchInput) {
    modalSearchInput.addEventListener("input", (e) => {
      const term = /** @type {HTMLInputElement} */ (
        e.target
      ).value.toLowerCase();
      const filtered = state.currentModalList.filter((m) =>
        m.name.includes(term),
      );
      renderModalList(filtered);
    });
  }
};
