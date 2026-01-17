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

// SVG 아이콘 정의
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

// 디바운스 유틸리티 (취소 가능)
const debounce = (func, wait) => {
  let timeout;
  const debouncedFn = (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
  debouncedFn.cancel = () => clearTimeout(timeout);
  return debouncedFn;
};

// 카테고리의 지역별 아이템 개수 계산 (ES2023+ 문법 적용)
const getCategoryItemsByRegion = (categoryId) => {
  const regionCounts = {};
  for (const m of state.allMarkers.values()) {
    if (m.category === categoryId) {
      const region = m.region ?? "알 수 없음";
      regionCounts[region] ??= 0; // Logical nullish assignment
      regionCounts[region]++;
    }
  }
  return regionCounts;
};

// 현재 표시할 지역 수 (더보기 클릭 시 확장)
let expandedCategories = new Set();

// 검색 결과 렌더링
const renderSearchResults = (term, searchInput, searchResults) => {
  if (!term || term.length < 1) {
    searchResults.classList.add("hidden");
    searchResults.style.display = "none";
    resetMarkerOpacity();
    expandedCategories.clear();
    return;
  }

  // 지역 검색
  const matchedRegions = Array.from(state.uniqueRegions)
    .filter((r) => t(r).toLowerCase().includes(term))
    .slice(0, 5);

  // 카테고리 검색
  const matchedCategories = [];
  // Optional chaining으로 안전한 접근
  for (const cat of state.mapData?.categories ?? []) {
    if (matchedCategories.length >= 8) break;
    const catId = cat.id ?? "";
    const catName = t(cat.name ?? cat.id).toLowerCase();
    if (catName.includes(term) || catId.toLowerCase().includes(term)) {
      matchedCategories.push(cat);
    }
  }

  // 결과가 없으면
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

  // 결과 HTML 생성
  let html = "";

  // 지역 섹션
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
      const markerCount = Array.from(state.allMarkers.values()).filter(
        (m) => m.region === region,
      ).length;
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

  // 카테고리 섹션 - 지역별로 분리하여 표시
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

      // 지역별로 표시
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

      // 더 많은 지역이 있으면 더보기 버튼 표시
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

  // 이벤트 리스너 추가
  searchResults.querySelectorAll(".search-embed-item").forEach((item) => {
    item.addEventListener("click", () => {
      const type = item.dataset.type;

      if (type === "region") {
        const region = item.dataset.region;
        handleRegionClick(region, searchInput, searchResults);
      } else if (type === "category-region") {
        const categoryId = item.dataset.category;
        const region = item.dataset.region;
        handleCategoryRegionClick(
          categoryId,
          region,
          searchInput,
          searchResults,
        );
      }
    });
  });

  // 더보기 버튼 이벤트 리스너
  searchResults.querySelectorAll(".search-more-regions").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault(); // blur 이벤트 방지
      e.stopPropagation();
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const catId = btn.dataset.category;
      expandedCategories.add(catId);
      // 검색 결과 다시 렌더링
      const term = searchInput.value.trim().toLowerCase();
      renderSearchResults(term, searchInput, searchResults);
      // 포커스 유지
      searchInput.focus();
    });
  });

  showSearchResults(searchResults);
  highlightMatchingMarkers(term);
};

// 검색 결과 표시
const showSearchResults = (searchResults) => {
  searchResults.classList.remove("hidden");
  searchResults.style.display = "block";
  searchResults.style.visibility = "visible";
  searchResults.style.opacity = "1";
  searchResults.style.pointerEvents = "auto";
};

// 검색 결과 숨기기
const hideSearchResults = (searchResults) => {
  searchResults.classList.add("hidden");
  searchResults.style.display = "none";
  searchResults.style.visibility = "hidden";
  searchResults.style.opacity = "0";
  searchResults.style.pointerEvents = "none";
};

// 모든 필터 복원 (검색 취소 시)
const restoreAllFilters = () => {
  // 모든 카테고리 활성화 (Optional chaining 적용)
  state.activeCategoryIds.clear();
  state.mapData?.categories?.forEach((cat) => {
    state.activeCategoryIds.add(cat.id);
  });

  // 모든 지역 활성화
  state.activeRegionNames.clear();
  state.uniqueRegions.forEach((region) => {
    state.activeRegionNames.add(region);
  });

  // UI 업데이트
  const catBtns = document.querySelectorAll("#category-list .cate-item");
  catBtns.forEach((btn) => btn.classList.add("active"));

  const regBtns = document.querySelectorAll("#region-list .cate-item");
  regBtns.forEach((btn) => btn.classList.add("active"));

  updateToggleButtonsState();
  renderMapDataAndMarkers();
  saveFilterState();
};

// 마커 불투명도 리셋
const resetMarkerOpacity = () => {
  state.allMarkers.forEach((m) => {
    if (m.marker) m.marker.setOpacity(1);
    else if (m.sprite) m.sprite.alpha = 1;
  });
  // Optional chaining으로 안전한 메서드 호출
  if (state.gpuRenderMode) state.pixiOverlay?.redraw();
};

// 매칭 마커 하이라이트
const highlightMatchingMarkers = (term) => {
  if (!term) {
    resetMarkerOpacity();
    return;
  }

  state.allMarkers.forEach((m) => {
    const regionName = t(m.region).toLowerCase();
    const categoryName = t(m.category).toLowerCase();
    const name = m.name.toLowerCase();
    const translatedName = t(m.name).toLowerCase();

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

  // Optional chaining으로 안전한 메서드 호출
  if (state.gpuRenderMode) state.pixiOverlay?.redraw();
};

// 지역 클릭 핸들러
const handleRegionClick = (region, searchInput, searchResults) => {
  searchInput.value = t(region);
  hideSearchResults(searchResults);
  resetMarkerOpacity();

  state.activeRegionNames.clear();
  state.activeRegionNames.add(region);

  const regBtns = document.querySelectorAll("#region-list .cate-item");
  regBtns.forEach((btn) => {
    if (btn.dataset.region === region) {
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

// 카테고리 + 지역 클릭 핸들러
const handleCategoryRegionClick = (
  categoryId,
  region,
  searchInput,
  searchResults,
) => {
  const catName = t(categoryId);
  const regionName = t(region);
  searchInput.value = `${catName} - ${regionName}`;
  hideSearchResults(searchResults);
  resetMarkerOpacity();

  // 해당 카테고리와 지역 모두 활성화
  state.activeCategoryIds.clear();
  state.activeCategoryIds.add(categoryId);

  state.activeRegionNames.clear();
  state.activeRegionNames.add(region);

  // 카테고리 버튼 업데이트
  const catBtns = document.querySelectorAll("#category-list .cate-item");
  catBtns.forEach((btn) => {
    if (btn.dataset.id === categoryId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // 지역 버튼 업데이트
  const regBtns = document.querySelectorAll("#region-list .cate-item");
  regBtns.forEach((btn) => {
    if (btn.dataset.region === region) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  updateToggleButtonsState();
  renderMapDataAndMarkers();
  saveFilterState();

  // 해당 지역으로 이동
  const meta = state.regionMetaInfo[region];
  if (meta) {
    state.map.flyTo([meta.lat, meta.lng], meta.zoom, {
      animate: true,
      duration: 1.0,
    });
  }
};

// 검색 초기화
export const initSearch = () => {
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");

  console.log("[Search] Initializing...", { searchInput, searchResults });

  if (!searchInput || !searchResults) {
    console.error("[Search] Search elements not found!");
    return;
  }

  // 디바운스된 검색 핸들러
  const debouncedSearch = debounce((term) => {
    renderSearchResults(term, searchInput, searchResults);
  }, 200);

  // 입력 이벤트
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    console.log("[Search] Input term:", term);

    if (term === "") {
      // 디바운스 취소하고 즉시 닫기
      debouncedSearch.cancel();
      hideSearchResults(searchResults);
      resetMarkerOpacity();
      expandedCategories.clear();

      // 모든 지역과 카테고리 다시 활성화
      restoreAllFilters();
      return;
    }

    debouncedSearch(term);
  });

  // blur 이벤트 - 검색 결과 내부 클릭 시에는 닫지 않음
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

  // focus 이벤트
  searchInput.addEventListener("focus", () => {
    const term = searchInput.value.trim().toLowerCase();
    if (term.length >= 1) {
      renderSearchResults(term, searchInput, searchResults);
    }
  });
};

// 모달 검색 초기화 (기존 호환성)
export const initModalSearch = (renderModalList) => {
  const modalSearchInput = document.getElementById("modal-search-input");
  if (modalSearchInput) {
    modalSearchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = state.currentModalList.filter((m) =>
        m.name.includes(term),
      );
      renderModalList(filtered);
    });
  }
};
