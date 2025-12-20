import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const BACKEND_URL = 'https://api.wwmmap.kro.kr:5555';

let app;
let db;
let storage;
let auth;

export const firebaseInitialized = (async () => {
    try {
        let config;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // 모바일 환경일 경우 로컬 env.js 우선 시도 (포트 차단 대비)
        if (isMobile) {
            console.log("[Firebase] Mobile environment detected. Attempting to load local config first...");
            try {
                const { FIREBASE_CONFIG } = await import('./env.js');
                if (FIREBASE_CONFIG) {
                    config = {
                        firebaseConfig: FIREBASE_CONFIG
                    };
                    console.log("[Firebase] Local config loaded from js/env.js (Mobile optimization)");
                }
            } catch (envError) {
                console.warn("[Firebase] Local config load failed on mobile, falling back to backend:", envError.message);
            }
        }

        // 로컬 설정을 불러오지 못했거나 모바일이 아닐 경우 백엔드 시도
        if (!config) {
            let response;
            try {
                response = await fetch(BACKEND_URL, { cache: 'no-cache' });
                if (!response.ok) {
                    throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
                }
                config = await response.json();
                console.log("[Firebase] Config loaded from backend");
            } catch (fetchError) {
                console.error("[Firebase] Fetch failed for BACKEND_URL:", BACKEND_URL);

                // 모바일이 아니어서 위에서 시도하지 않았던 경우에만 여기서 최후의 수단으로 시도
                if (!isMobile) {
                    console.warn("[Firebase] Attempting to load fallback config from js/env.js...");
                    try {
                        const { FIREBASE_CONFIG } = await import('./env.js');
                        if (FIREBASE_CONFIG) {
                            config = {
                                firebaseConfig: FIREBASE_CONFIG
                            };
                            console.log("[Firebase] Fallback config loaded from js/env.js");
                        }
                    } catch (envError) {
                        console.error("[Firebase] Fallback also failed:", envError.message);
                        throw fetchError;
                    }
                } else {
                    throw fetchError;
                }
            }
        }

        console.log("[Firebase] Config initialized:", {
            source: config.firebaseConfig.apiKey ? "Valid Config" : "Invalid",
            hasFirebaseConfig: !!config.firebaseConfig,
            hostname: location.hostname
        });

        if (!config.firebaseConfig) {
            throw new Error('Firebase config not found');
        }

        app = initializeApp(config.firebaseConfig);
        db = getFirestore(app);
        storage = getStorage(app);
        auth = getAuth(app);

        const urlParams = new URLSearchParams(window.location.search);
        const isDebug = location.hostname === "localhost" || location.hostname === "127.0.0.1" || urlParams.get('debug') === 'true';

        if (isDebug) {
            console.log("%c[Firebase] Debug Mode Active", "color: #ff9800; font-weight: bold;");
        }

    } catch (error) {
        console.error("%c[Firebase] Critical Initialization Error:", "color: red; font-weight: bold;", error);
        throw error;
    }
})();

export { db, storage, auth };
