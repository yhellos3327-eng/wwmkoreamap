// @ts-check
/**
 * @fileoverview Debug and developer tools module.
 * - Developer helper functions available from the console
 * - Global variable exposure for debugging
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
   * [DEBUG] Simulates a legacy localStorage user for migration testing.
   * Clears Vault and sets dummy data in localStorage.
   */
  /** @type {any} */ (window).resetToLocalStorageUser = async () => {
    if (!confirm("⚠️ WARNING: This will WIPE all current data and reset to a dummy legacy state. Continue?")) return;

    try {
      // 1. Clear Vault (IndexedDB)
      const { primaryDb, db } = await import("./storage/db.js");
      await primaryDb.clear();
      // await db.clear(); // Optional: clear backups too if needed

      // 2. Set localStorage data (Legacy format)
      const dummyCompleted = ["101", "102", "103"]; // Example IDs
      const dummyFavorites = ["201", "202"];

      localStorage.setItem("wwm_completed", JSON.stringify(dummyCompleted));
      localStorage.setItem("wwm_favorites", JSON.stringify(dummyFavorites));
      localStorage.setItem("wwm_show_comments", "true");

      // 3. Reset migration version
      localStorage.removeItem("wwm_migration_version");

      console.log("%c[RESET] Environment reset to Legacy LocalStorage User.", "color: #00ff00; font-weight: bold");
      console.log("Data set:", { completed: dummyCompleted, favorites: dummyFavorites });
      console.log("Please RELOAD the page to trigger migration.");

      alert("Reset complete. Please reload the page.");
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
  if (state.isDevMode || devMode === "true") {
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
