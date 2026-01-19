/**
 * 애플리케이션 메인 엔트리 포인트
 * - 앱 초기화 오케스트레이션
 * - 각 모듈의 초기화 함수 호출
 */
import { state, setState, subscribe } from "./state.js";
import { loadMapData } from "./data.js";
import { renderMapDataAndMarkers } from "./map.js";
import { renderFavorites, initCustomDropdown, renderModalList } from "./ui.js";
import { initMainNotice } from "./main-notice.js";
import { initAuth } from "./auth.js";
import { initSearch, initModalSearch } from "./search.js";
import { initAllEventHandlers } from "./events.js";
import { initPopupEventDelegation } from "./map/popup.js";
import { initMigration, isOldDomain } from "./migration.js";
import { initAds } from "./ads.js";
import { initTheme } from "./theme.js";
import { loadAllComponents } from "./component-loader.js";

import { handleUrlParams, handleSharedLink } from "./urlHandler.js";
import { initSyncHandler } from "./syncHandler.js";
import { initDebug, loadDevToolsIfNeeded } from "./debug.js";

/**
 * 로딩 화면 구독 설정
 */
const setupLoadingSubscription = () => {
  subscribe("loadingState", (loadingState) => {
    const loadingScreen = document.getElementById("loading-screen");
    const loadingBar = document.getElementById("loading-bar");
    const loadingText = document.getElementById("loading-text");
    const loadingDetail = document.getElementById("loading-detail");

    if (!loadingState.isVisible) {
      if (loadingScreen) loadingScreen.classList.add("hidden");
      initMainNotice();
      return;
    }

    const WEIGHTS = { csv: 0.3, map: 0.7 };
    const total =
      loadingState.csvProgress * WEIGHTS.csv +
      loadingState.mapProgress * WEIGHTS.map;

    if (loadingBar)
      loadingBar.style.width = `${Math.min(100, Math.round(total))}%`;
    if (loadingText) loadingText.textContent = loadingState.message;
    if (loadingDetail) loadingDetail.textContent = loadingState.detail;
  });
};

/**
 * 맵 데이터 로딩 및 진행률 표시
 */
const loadMapDataWithProgress = async () => {
  setState("loadingState", {
    ...state.loadingState,
    csvProgress: 100,
    message: "지도 데이터 불러오는 중...",
  });

  await loadMapData(state.currentMapKey, (loaded, total) => {
    if (total > 0) {
      const percent = Math.min(100, (loaded / total) * 100);
      setState("loadingState", {
        ...state.loadingState,
        mapProgress: percent,
        detail: `지도 데이터: ${Math.round(percent)}%`,
      });
    }
  });

  setState("loadingState", {
    ...state.loadingState,
    mapProgress: 100,
    message: "준비 완료!",
  });

  setTimeout(() => {
    setState("loadingState", { ...state.loadingState, isVisible: false });
  }, 500);
};

/**
 * 비필수 모듈 지연 로딩
 */
const loadOptionalModules = () => {
  // WebLLM은 버튼 클릭 시 동적으로 로드되므로 여기서 미리 로드하지 않음
  // if (state.enableWebLLM) {
  //   import("./web-llm.js")
  //     .then((m) => m.initWebLLM())
  //     .catch((e) => console.warn("WebLLM init failed:", e));
  // }

  import("./settings.js").then(({ initSettingsModal, initAdToggle }) => {
    initSettingsModal();
    initAdToggle();
  });

  import("./backup.js").then(({ initBackupButtons }) => {
    initBackupButtons();
  });

  import("./comments.js");

  loadDevToolsIfNeeded();
};

/**
 * 번역 CSV 로딩
 */
const loadTranslationData = () => {
  fetch("./translation.csv")
    .then((res) => res.text())
    .then((text) => setState("rawCSV", text));
};

/**
 * 애플리케이션 초기화
 */
const initializeApp = async () => {
  initTheme();
  initMigration();

  if (isOldDomain()) {
    return;
  }

  console.log("[Main] Initial localStorage check:", {
    completed: localStorage.getItem("wwm_completed"),
    favorites: localStorage.getItem("wwm_favorites"),
  });

  const urlParams = handleUrlParams();

  try {
    await loadAllComponents();

    if (!document.body.classList.contains("embed-mode")) {
      document.body.classList.add("sidebar-open");
    }

    setupLoadingSubscription();
    initSyncHandler();

    initAuth();
    loadTranslationData();
    initCustomDropdown();

    await loadMapDataWithProgress();

    initSearch();
    initModalSearch(renderModalList);
    initAllEventHandlers();
    initPopupEventDelegation();

    initAds();
    renderFavorites();

    loadOptionalModules();
  } catch (error) {
    console.error("초기화 실패:", error);
    alert("맵 초기화에 실패했습니다.\n" + error.message);
    return;
  }

  handleSharedLink(urlParams);
};

initDebug();

document.addEventListener("DOMContentLoaded", initializeApp);
