// @ts-check
/**
 * 디버그 및 개발자 도구 모음 모듈.
 * - 콘솔에서 사용 가능한 개발자 도우미 함수
 * - 디버깅을 위한 전역 변수 노출
 * @module debug
 */
import { state, setState, subscribe, dispatch } from "./state.js";
import { findItem, jumpToId } from "./ui.js";
import { memoryManager } from "./memory.js";

/**
 * 전역 디버그 변수 초기화
 * - window.state, window.setState 등 콘솔 디버깅용 전역 변수 설정
 */
export const initGlobalDebugHelpers = () => {
  window.state = state;
  window.setState = setState;
  window.dispatch = dispatch;
  window.subscribe = subscribe;

  window.findItem = findItem;
  window.finditem = findItem;
  window.jumpToId = jumpToId;

  window.memoryManager = memoryManager;

  window.dev = async () => {
    const { dev } = await import("./dev-tools.js");
    return dev();
  };

  /**
   * [DEBUG] 마이그레이션 테스트를 위해 레거시 localStorage 사용자를 시뮬레이션합니다.
   * Vault를 지우고 localStorage에 더미 데이터를 설정합니다.
   */
  /** @type {any} */ (window).resetToLocalStorageUser = async () => {
    if (!confirm("⚠️ 경고: 현재 모든 데이터를 삭제하고 더미 레거시 상태로 초기화합니다. 계속하시겠습니까?")) return;

    try {
      const { primaryDb, db } = await import("./storage/db.js");
      await primaryDb.clear();

      const dummyCompleted = ["101", "102", "103"];
      const dummyFavorites = ["201", "202"];

      localStorage.setItem("wwm_completed", JSON.stringify(dummyCompleted));
      localStorage.setItem("wwm_favorites", JSON.stringify(dummyFavorites));
      localStorage.setItem("wwm_show_comments", "true");

      // 3. 마이그레이션 버전 리셋
      localStorage.removeItem("wwm_migration_version");

      console.log("%c[RESET] 환경이 레거시 LocalStorage 사용자 상태로 초기화되었습니다.", "color: #00ff00; font-weight: bold");
      console.log("설정된 데이터:", { completed: dummyCompleted, favorites: dummyFavorites });
      console.log("마이그레이션을 트리거하려면 페이지를 새로고침하세요.");

      alert("초기화 완료. 페이지를 새로고침해주세요.");
      location.reload();

    } catch (e) {
      console.error("Reset failed:", e);
    }
  };
};

/**
 * 개발 모드 구독 설정
 * - isDevMode 상태 변경 시 메모리 매니저 디버그 모드 설정
 */
export const initDevModeSubscription = () => {
  subscribe("isDevMode", (isDev) => {
    memoryManager.setDebug(isDev);
    if (isDev) {
      console.log(
        "%c[MemoryManager] Debug mode enabled. Watch console for GC events.",
        "color: #ff00ff",
      );
    }
  });
};

/**
 * 개발 모드 확인 및 dev-tools 로드
 */
export const loadDevToolsIfNeeded = async () => {
  const { primaryDb } = await import("./storage/db.js");
  const devMode = await primaryDb.get("wwm_dev_mode");
  if (state.isDevMode || devMode === true || devMode === "true") {
    import("./dev-tools.js");
  }
};

/**
 * 모든 디버그 초기화 함수 실행
 */
export const initDebug = () => {
  initGlobalDebugHelpers();
  initDevModeSubscription();
};
