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
export const loadDevToolsIfNeeded = () => {
  if (state.isDevMode || localStorage.getItem("wwm_dev_mode") === "true") {
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
