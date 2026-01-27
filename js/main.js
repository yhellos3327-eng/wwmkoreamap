// @ts-check
/**
 * 애플리케이션 메인 엔트리 포인트
 * - 앱 초기화 오케스트레이션
 * - 각 모듈의 초기화 함수 호출
 */
import { state, setState, subscribe, initStateFromVault } from "./state.js";
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
import { createLogger } from "./utils/logStyles.js";

const log = createLogger("Main");

/**
 * 로딩 화면 구독 설정
 * @returns {void}
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
 * @returns {Promise<void>}
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
 * @returns {void}
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
 * @returns {void}
 */
const loadTranslationData = () => {
  fetch("./translation.csv")
    .then((res) => res.text())
    .then((text) => setState("rawCSV", text));
};

/**
 * 애플리케이션 초기화
 * @returns {Promise<void>}
 */
import { autoRestoreIfEmpty, saveToVault } from "./storage/vault.js";

/**
 * Vault 마이그레이션 및 데이터 복구 초기화
 * DEXIE.JS MIGRATION: localStorage → Vault 마이그레이션 후 state 초기화
 * @returns {Promise<void>}
 */
const initVaultAndMigration = async () => {
  log.migration("Vault Migration 시작", new Date().toISOString());

  try {
    // Step 1: localStorage -> Vault 마이그레이션 (기존 사용자)
    const { migrateToVault, getMigrationStatus } = await import("./storage/migration.js");

    // 마이그레이션 전 상태 출력
    const preStatus = await getMigrationStatus();
    log.info("마이그레이션 전 상태", {
      version: preStatus.version,
      vaultHasData: preStatus.vaultHasData,
      localHasData: preStatus.localHasData
    });

    const migrationResult = await migrateToVault();

    log.info("마이그레이션 결과", {
      success: migrationResult.success,
      migrated: migrationResult.migrated,
      source: migrationResult.source,
      completed: migrationResult.completedCount,
      favorites: migrationResult.favoritesCount
    });

    if (migrationResult.migrated) {
      log.success("localStorage → Vault 마이그레이션 완료!");
    } else if (migrationResult.source === "vault") {
      log.vault("이미 Vault 사용 중 (마이그레이션 불필요)");
    }

    // Step 2: [CRITICAL] Vault에서 state 초기화 (Dexie.js 기반)
    // 이제 state.js는 빈 배열로 시작하므로, 반드시 Vault에서 로드해야 함
    log.info("Vault에서 state 초기화 중...");
    const stateResult = await initStateFromVault();
    log.success("State 초기화 완료", {
      completed: stateResult.completedList.length,
      favorites: stateResult.favorites.length
    });

  } catch (e) {
    log.error("Vault 마이그레이션 실패", e);

    // 실패 시에도 state 초기화 시도
    try {
      await initStateFromVault();
    } catch (initError) {
      log.error("State 초기화도 실패", initError);
    }
  }

  // Step 3: 기존 autoRestoreIfEmpty (폴백 안전장치)
  try {
    const result = await autoRestoreIfEmpty();
    if (result.restored) {
      log.success("데이터가 손실되어 Vault에서 자동 복구되었습니다");
    }
  } catch (e) {
    log.error("Auto-restore 실패", e);
  }

  // Step 4: 데이터 무결성 체크
  await verifyDataIntegrity();
};

/**
 * 데이터 무결성 검증 (Vault와 State 일치 확인)
 * DEXIE.JS MIGRATION: localStorage 검증 제거, Vault ↔ State만 확인
 * @returns {Promise<void>}
 */
const verifyDataIntegrity = async () => {
  try {
    const { primaryDb } = await import("./storage/db.js");

    // Vault 데이터 확인
    const vaultCompleted = await primaryDb.get("completedList");
    const vaultFavorites = await primaryDb.get("favorites");

    // 현재 state 확인
    const stateCompleted = state.completedList?.length || 0;
    const stateFavorites = state.favorites?.length || 0;

    const vaultTotal = (Array.isArray(vaultCompleted) ? vaultCompleted.length : 0) +
      (Array.isArray(vaultFavorites) ? vaultFavorites.length : 0);
    const stateTotal = stateCompleted + stateFavorites;

    if (vaultTotal !== stateTotal) {
      log.warn("Vault ↔ State 불일치!", { vault: vaultTotal, state: stateTotal });

      // Vault가 더 많으면 state 재동기화
      if (vaultTotal > stateTotal) {
        log.info("Vault 기준 state 재동기화...");
        await initStateFromVault();
      }
    } else {
      log.success("데이터 무결성 확인 완료", { total: vaultTotal });
    }

    // deleted: true 항목 체크 (sync 관련)
    if (Array.isArray(vaultCompleted)) {
      const deletedItems = vaultCompleted.filter(item => item?.deleted === true);
      if (deletedItems.length > 0) {
        log.info(`deleted: true 항목`, deletedItems.length);
      }
    }

  } catch (e) {
    log.error("무결성 검증 실패", e);
  }
};

/**
 * 애플리케이션 초기화
 * @returns {Promise<void>}
 */
const initializeApp = async () => {
  await initTheme();
  initMigration();

  if (isOldDomain()) {
    return;
  }

  // [DEXIE.JS] 마이그레이션 및 Vault에서 state 초기화
  await initVaultAndMigration();

  log.info("State 초기화 후 확인", {
    completed: state.completedList?.length || 0,
    favorites: state.favorites?.length || 0,
    isStateInitialized: state.isStateInitialized
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

    // [Vault] 앱 종료/숨김 시 자동 백업
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        saveToVault("auto_save");
      }
    });

  } catch (error) {
    log.error("초기화 실패", error);
    alert("맵 초기화에 실패했습니다.\n" + error.message);
    return;
  }

  handleSharedLink(urlParams);
};

initDebug();

document.addEventListener("DOMContentLoaded", initializeApp);
