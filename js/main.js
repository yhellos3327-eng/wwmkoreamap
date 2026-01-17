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

// 분리된 모듈들
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
  // WebLLM 초기화 (사전 캐시 시작)
  import("./web-llm.js")
    .then((m) => m.initWebLLM())
    .catch((e) => console.warn("WebLLM init failed:", e));

  // 설정 모듈
  import("./settings.js").then(({ initSettingsModal, initAdToggle }) => {
    initSettingsModal();
    initAdToggle();
  });

  // 백업 모듈
  import("./backup.js").then(({ initBackupButtons }) => {
    initBackupButtons();
  });

  // 댓글 모듈 (Side-effect import)
  import("./comments.js");

  // 개발자 도구 (조건부)
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
  // 1. 테마 및 마이그레이션 먼저 처리
  initTheme();
  initMigration();

  // 구 도메인이면 리다이렉트 처리 후 종료
  if (isOldDomain()) {
    return;
  }

  console.log("[Main] Initial localStorage check:", {
    completed: localStorage.getItem("wwm_completed"),
    favorites: localStorage.getItem("wwm_favorites"),
  });

  // 2. URL 파라미터 처리
  const urlParams = handleUrlParams();

  try {
    // 3. HTML 컴포넌트 로딩
    await loadAllComponents();

    // 사이드바 기본 열기 (임베드 모드 제외)
    if (!document.body.classList.contains("embed-mode")) {
      document.body.classList.add("sidebar-open");
    }

    // 4. 구독 및 핸들러 설정
    setupLoadingSubscription();
    initSyncHandler();

    // 5. 인증 및 데이터 로딩
    initAuth();
    loadTranslationData();
    initCustomDropdown();

    // 6. 맵 데이터 로딩
    await loadMapDataWithProgress();

    // 7. 검색 및 이벤트 핸들러 초기화
    initSearch();
    initModalSearch(renderModalList);
    initAllEventHandlers();
    initPopupEventDelegation();

    // 8. 광고 및 UI 렌더링
    initAds();
    renderFavorites();

    // 9. 비필수 모듈 지연 로딩
    loadOptionalModules();
  } catch (error) {
    console.error("초기화 실패:", error);
    alert("맵 초기화에 실패했습니다.\n" + error.message);
    return;
  }

  // 10. 공유 링크 처리 (초기화 완료 후)
  handleSharedLink(urlParams);
};

// 디버그 헬퍼 초기화 (즉시 실행)
initDebug();

// DOM 로드 후 앱 초기화
document.addEventListener("DOMContentLoaded", initializeApp);
