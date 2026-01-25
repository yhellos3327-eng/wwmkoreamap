// @ts-check
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
 * SAFETY: localStorage와 Vault 중 더 많은 데이터를 가진 쪽을 사용
 * @returns {Promise<void>}
 */
const initVaultAndMigration = async () => {
  console.group("🔐 [Vault Migration] 시작");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("%c🔗 코드 연결 확인: initVaultAndMigration 실행됨", "color: lime; font-weight: bold; background: #333; padding: 2px 6px;");
  console.log("📅 빌드 타임스탬프:", new Date().toISOString());

  try {
    // Step 1: localStorage -> Vault 마이그레이션 (기존 사용자)
    const { migrateToVault, loadDataWithFallback, getMigrationStatus } = await import("./storage/migration.js");

    // 마이그레이션 전 상태 출력
    const preStatus = await getMigrationStatus();
    console.log("📊 마이그레이션 전 상태:", {
      migrationVersion: preStatus.version,
      vaultHasData: preStatus.vaultHasData,
      localHasData: preStatus.localHasData
    });

    const migrationResult = await migrateToVault();

    console.log("📦 마이그레이션 결과:", {
      success: migrationResult.success,
      migrated: migrationResult.migrated,
      source: migrationResult.source,
      completedCount: migrationResult.completedCount,
      favoritesCount: migrationResult.favoritesCount
    });

    if (migrationResult.migrated) {
      console.log("%c✅ localStorage → Vault 마이그레이션 완료!", "color: green; font-weight: bold");
    } else if (migrationResult.source === "vault") {
      console.log("%c✅ 이미 Vault 사용 중 (마이그레이션 불필요)", "color: blue; font-weight: bold");
    }

    // Step 2: 현재 state (localStorage에서 로드됨)와 Vault 비교
    const loadResult = await loadDataWithFallback();

    console.log("📦 loadDataWithFallback 결과:", {
      source: loadResult.source,
      completedCount: loadResult.completedList.length,
      favoritesCount: loadResult.favorites.length
    });

    if (loadResult.source !== "none") {
      console.log(`%c📦 데이터 로드 완료 (소스: ${loadResult.source})`, "color: cyan; font-weight: bold");

      // SAFETY FIX: localStorage와 Vault 중 더 많은 데이터 사용
      const currentCompleted = state.completedList || [];
      const currentFavorites = state.favorites || [];

      const currentCount = currentCompleted.length + currentFavorites.length;
      const vaultCount = loadResult.completedList.length + loadResult.favorites.length;

      console.log("🔄 데이터 비교:", {
        "localStorage (현재 state)": {
          completed: currentCompleted.length,
          favorites: currentFavorites.length,
          total: currentCount
        },
        "Vault/loadResult": {
          completed: loadResult.completedList.length,
          favorites: loadResult.favorites.length,
          total: vaultCount
        }
      });

      // Vault 데이터가 더 많거나 같을 때만 Vault로 업데이트
      // (구버전 사용으로 localStorage에 더 많은 데이터가 있을 수 있음)
      if (vaultCount >= currentCount) {
        console.log("%c✅ Vault 데이터 사용 (더 많거나 같음)", "color: green; font-weight: bold");
        if (loadResult.completedList.length > 0) {
          setState("completedList", loadResult.completedList);
        }
        if (loadResult.favorites.length > 0) {
          setState("favorites", loadResult.favorites);
        }
      } else {
        // localStorage가 더 많음 → localStorage 데이터를 Vault에 동기화
        console.log("%c⚠️ localStorage에 더 많은 데이터 발견 → Vault로 동기화", "color: orange; font-weight: bold");
        try {
          const { primaryDb } = await import("./storage/db.js");
          await primaryDb.setMultiple([
            { key: "completedList", value: currentCompleted },
            { key: "favorites", value: currentFavorites }
          ]);
          console.log("%c✅ localStorage → Vault 동기화 완료", "color: green");
        } catch (e) {
          console.warn("[Main] Vault 동기화 실패:", e);
        }
      }
    }
  } catch (e) {
    console.error("[Main] Vault 마이그레이션 실패:", e);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.groupEnd();

  // Step 3: 기존 autoRestoreIfEmpty (폴백 안전장치)
  try {
    const result = await autoRestoreIfEmpty();
    if (result.restored) {
      console.log("[Main] 🛡️ 데이터가 손실되어 Vault에서 자동 복구되었습니다.");
    }
  } catch (e) {
    console.error("[Main] Auto-restore 실패:", e);
  }

  // Step 4: 배포 후 데이터 무결성 체크
  await verifyDataIntegrity();
};

/**
 * 데이터 무결성 검증 (배포 후 안정성 체크)
 * @returns {Promise<void>}
 */
const verifyDataIntegrity = async () => {
  console.group("🔍 [Data Integrity] 무결성 검증");

  try {
    const { primaryDb } = await import("./storage/db.js");

    // Vault 데이터 확인
    const vaultCompleted = await primaryDb.get("completedList");
    const vaultFavorites = await primaryDb.get("favorites");

    // localStorage 데이터 확인
    let localCompleted = [];
    let localFavorites = [];

    try {
      const rawCompleted = localStorage.getItem("wwm_completed");
      if (rawCompleted) localCompleted = JSON.parse(rawCompleted);
    } catch (e) { console.warn("localStorage completedList 파싱 실패:", e); }

    try {
      const rawFavorites = localStorage.getItem("wwm_favorites");
      if (rawFavorites) localFavorites = JSON.parse(rawFavorites);
    } catch (e) { console.warn("localStorage favorites 파싱 실패:", e); }

    // 현재 state 확인
    const stateCompleted = state.completedList?.length || 0;
    const stateFavorites = state.favorites?.length || 0;

    const integrityReport = {
      vault: {
        completed: Array.isArray(vaultCompleted) ? vaultCompleted.length : 0,
        favorites: Array.isArray(vaultFavorites) ? vaultFavorites.length : 0
      },
      localStorage: {
        completed: Array.isArray(localCompleted) ? localCompleted.length : 0,
        favorites: Array.isArray(localFavorites) ? localFavorites.length : 0
      },
      state: {
        completed: stateCompleted,
        favorites: stateFavorites
      }
    };

    console.table(integrityReport);

    // 불일치 감지
    const vaultTotal = integrityReport.vault.completed + integrityReport.vault.favorites;
    const localTotal = integrityReport.localStorage.completed + integrityReport.localStorage.favorites;
    const stateTotal = stateCompleted + stateFavorites;

    if (vaultTotal !== localTotal || vaultTotal !== stateTotal) {
      console.warn("%c⚠️ 데이터 불일치 감지!", "color: orange; font-weight: bold");
      console.log("Vault:", vaultTotal, "| localStorage:", localTotal, "| State:", stateTotal);

      // 가장 많은 데이터를 가진 소스를 기준으로 동기화
      const maxTotal = Math.max(vaultTotal, localTotal, stateTotal);
      if (maxTotal === vaultTotal) {
        console.log("→ Vault 기준 동기화");
      } else if (maxTotal === localTotal) {
        console.log("→ localStorage 기준 동기화 필요");
      } else {
        console.log("→ State 기준 동기화 필요");
      }
    } else {
      console.log("%c✅ 데이터 무결성 확인 완료", "color: green; font-weight: bold");
    }

    // deleted: true 항목 체크 (sync 관련)
    if (Array.isArray(vaultCompleted)) {
      const deletedItems = vaultCompleted.filter(item => item?.deleted === true);
      if (deletedItems.length > 0) {
        console.log(`📌 deleted: true 항목: ${deletedItems.length}개`, deletedItems);
      }
    }

  } catch (e) {
    console.error("무결성 검증 실패:", e);
  }

  console.groupEnd();
};

/**
 * 애플리케이션 초기화
 * @returns {Promise<void>}
 */
const initializeApp = async () => {
  initTheme();
  initMigration();

  if (isOldDomain()) {
    return;
  }

  // [Vault] 마이그레이션 및 데이터 복구
  await initVaultAndMigration();

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

    // [Vault] 앱 종료/숨김 시 자동 백업
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        saveToVault("auto_save");
      }
    });

  } catch (error) {
    console.error("초기화 실패:", error);
    alert("맵 초기화에 실패했습니다.\n" + error.message);
    return;
  }

  handleSharedLink(urlParams);
};

initDebug();

document.addEventListener("DOMContentLoaded", initializeApp);
