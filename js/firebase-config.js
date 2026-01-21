// @ts-check
/**
 * @fileoverview Firebase configuration module - initializes Firebase services.
 * @module firebase-config
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

/** @type {string} */
const BACKEND_URL = "https://api.wwmmap.kro.kr:5555";

/** @type {any} */
let app;
/** @type {any} */
let db;
/** @type {any} */
let storage;
/** @type {any} */
let auth;

/**
 * Creates a styled log function.
 * @param {string} color - The color for the log.
 * @returns {string} CSS style string.
 */
const logStyle = (color) =>
  `font-size: 12px; font-weight: bold; color: ${color}; background: #222; padding: 3px 6px; border-radius: 3px;`;

/**
 * Firebase logger with styled console output.
 */
const firebaseLog = {
  /**
   * @param {string} msg
   * @param {...any} args
   */
  log: (msg, ...args) =>
    console.log(`%c🔥 [Firebase] ${msg}`, logStyle("#FFCA28"), ...args),
  /**
   * @param {string} msg
   * @param {...any} args
   */
  warn: (msg, ...args) =>
    console.warn(`%c🔥 [Firebase] ${msg}`, logStyle("#FFCA28"), ...args),
  /**
   * @param {string} msg
   * @param {...any} args
   */
  error: (msg, ...args) =>
    console.error(`%c🔥 [Firebase] ${msg}`, logStyle("#F44336"), ...args),
  /**
   * @param {string} msg
   * @param {...any} args
   */
  success: (msg, ...args) =>
    console.log(`%c🔥 [Firebase] ✅ ${msg}`, logStyle("#4CAF50"), ...args),
  /**
   * @param {string} msg
   * @param {...any} args
   */
  debug: (msg, ...args) =>
    console.log(`%c🔥 [Firebase] ${msg}`, logStyle("#FF9800"), ...args),
};

/**
 * Firebase initialization promise.
 * Resolves when Firebase is fully initialized.
 * @type {Promise<void>}
 */
export const firebaseInitialized = (async () => {
  try {
    /** @type {any} */
    let config;
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (isMobile) {
      firebaseLog.log("모바일 환경 감지, 로컬 설정 우선 시도...");
      try {
        const { FIREBASE_CONFIG } = await import("./env.js");
        if (FIREBASE_CONFIG) {
          config = {
            firebaseConfig: FIREBASE_CONFIG,
          };
          firebaseLog.success("로컬 설정 로드 완료 (env.js)");
        }
      } catch (envError) {
        firebaseLog.warn("로컬 설정 실패, 백엔드로 폴백:", envError.message);
      }
    }

    if (!config) {
      let response;
      try {
        response = await fetch(BACKEND_URL, { cache: "no-cache" });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch config: ${response.status} ${response.statusText}`,
          );
        }
        config = await response.json();
        firebaseLog.success("백엔드에서 설정 로드 완료");
      } catch (fetchError) {
        firebaseLog.error("백엔드 연결 실패:", BACKEND_URL);

        if (!isMobile) {
          firebaseLog.warn("폴백 설정 시도 (env.js)...");
          try {
            const { FIREBASE_CONFIG } = await import("./env.js");
            if (FIREBASE_CONFIG) {
              config = {
                firebaseConfig: FIREBASE_CONFIG,
              };
              firebaseLog.success("폴백 설정 로드 완료 (env.js)");
            }
          } catch (envError) {
            firebaseLog.error("폴백 설정도 실패:", envError.message);
            throw fetchError;
          }
        } else {
          throw fetchError;
        }
      }
    }

    firebaseLog.log("초기화 완료", {
      source: config.firebaseConfig.apiKey ? "Valid Config" : "Invalid",
      hasFirebaseConfig: !!config.firebaseConfig,
      hostname: location.hostname,
    });

    if (!config.firebaseConfig) {
      throw new Error("Firebase config not found");
    }

    app = initializeApp(config.firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);

    const urlParams = new URLSearchParams(window.location.search);
    const isDebug =
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      urlParams.get("debug") === "true";

    if (isDebug) {
      firebaseLog.debug("디버그 모드 활성화");
    }
  } catch (error) {
    firebaseLog.error("치명적 초기화 오류:", error);
    throw error;
  }
})();

export { db, storage, auth };
