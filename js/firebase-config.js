
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

// Backend URL - Change this to your deployed backend URL
const BACKEND_URL = 'http://211.253.7.150:5555';

let app;
let db;
let storage;
let auth;
let appCheck;

try {
    const response = await fetch(`${BACKEND_URL}/api/config`);
    if (!response.ok) throw new Error('Failed to fetch config');

    const config = await response.json();

    if (!config.firebaseConfig) {
        throw new Error('Firebase config not found in response');
    }

    app = initializeApp(config?.firebaseConfig);

    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = "94634c86-7f59-4ed4-aff1-90211f4ffb1c";
    }

    if (config.recaptchaSiteKey) {
        appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(config.recaptchaSiteKey),
            isTokenAutoRefreshEnabled: true
        });
    }

    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);

} catch (error) {
    console.error("Error initializing Firebase:", error);
}

export { db, storage, appCheck, auth };
