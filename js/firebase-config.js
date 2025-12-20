
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const BACKEND_URL = 'https://api.wwmmap.kro.kr:5555';

let app;
let db;
let storage;
let auth;
let appCheck;

export const firebaseInitialized = (async () => {
    try {
        const response = await fetch(BACKEND_URL);
        if (!response.ok) throw new Error('Failed to fetch config');

        const config = await response.json();
        console.log("[Firebase] Config loaded from backend:", {
            hasFirebaseConfig: !!config.firebaseConfig,
            recaptchaSiteKey: config.recaptchaSiteKey,
            hostname: location.hostname
        });

        if (!config.firebaseConfig) {
            throw new Error('Firebase config not found in response');
        }

        app = initializeApp(config?.firebaseConfig);

        // App Check 전에 서비스 먼저 초기화 (App Check가 실패해도 서비스는 사용 가능하게)
        db = getFirestore(app);
        storage = getStorage(app);
        auth = getAuth(app);

        const urlParams = new URLSearchParams(window.location.search);
        const isDebug = location.hostname === "localhost" || location.hostname === "127.0.0.1" || urlParams.get('debug') === 'true';

        if (isDebug) {
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = "94634c86-7f59-4ed4-aff1-90211f4ffb1c";
            console.log("%c[Firebase] App Check Debug Mode Active", "color: #ff9800; font-weight: bold;");
        }

        if (config.recaptchaSiteKey) {
            try {
                let provider;
                if (isDebug) {
                    // 디버그 모드일 때는 reCAPTCHA를 로드하지 않고 커스텀 프로바이더 사용
                    provider = new CustomProvider({
                        getToken: () => Promise.resolve({
                            token: "94634c86-7f59-4ed4-aff1-90211f4ffb1c",
                            expireTimeMillis: Date.now() + 3600000,
                        })
                    });
                } else {
                    provider = new ReCaptchaV3Provider(config.recaptchaSiteKey);
                }

                console.log(`[Firebase] Initializing App Check (${isDebug ? "Debug" : "Production"})`);
                appCheck = initializeAppCheck(app, {
                    provider: provider,
                    isTokenAutoRefreshEnabled: true
                });
                console.log("[Firebase] App Check provider initialized");
            } catch (acError) {
                console.error("[Firebase] App Check initialization failed:", acError);
            }
        }

    } catch (error) {
        console.error("%c[Firebase] Critical Initialization Error:", "color: red; font-weight: bold;", error);
    }
})();

export { db, storage, appCheck, auth };
