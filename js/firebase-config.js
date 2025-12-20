
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app-check.js";
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

        const urlParams = new URLSearchParams(window.location.search);
        const isDebug = location.hostname === "localhost" || location.hostname === "127.0.0.1" || urlParams.get('debug') === 'true';

        if (isDebug) {
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = "94634c86-7f59-4ed4-aff1-90211f4ffb1c";
            console.log("[Firebase] App Check Debug Mode Active");
        }

        if (config.recaptchaSiteKey) {
            try {
                console.log("[Firebase] Initializing App Check. Mode:", isDebug ? "Debug" : "Production");
                appCheck = initializeAppCheck(app, {
                    provider: new ReCaptchaV3Provider(config.recaptchaSiteKey),
                    isTokenAutoRefreshEnabled: true
                });
            } catch (acError) {
                console.error("[Firebase] App Check initialization failed:", acError);
            }
        }

        db = getFirestore(app);
        storage = getStorage(app);
        auth = getAuth(app);

    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }
})();

export { db, storage, appCheck, auth };
