// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app-check.js";
import * as env from './env.js';
// import { FIREBASE_CONFIG, RECAPTCHA_SITE_KEY } from './env.js';

let FIREBASE_CONFIG;
let RECAPTCHA_SITE_KEY;

if (env.FIREBASE_CONFIG) {
    FIREBASE_CONFIG = env.FIREBASE_CONFIG;
} else if (env.FIREBASE_CONFIG_BASE64) {
    try {
        FIREBASE_CONFIG = JSON.parse(atob(env.FIREBASE_CONFIG_BASE64));
    } catch (e) {
        console.error("Failed to decode FIREBASE_CONFIG", e);
    }
}

if (env.RECAPTCHA_SITE_KEY) {
    RECAPTCHA_SITE_KEY = env.RECAPTCHA_SITE_KEY;
} else if (env.RECAPTCHA_SITE_KEY_BASE64) {
    try {
        RECAPTCHA_SITE_KEY = atob(env.RECAPTCHA_SITE_KEY_BASE64);
    } catch (e) {
        console.error("Failed to decode RECAPTCHA_SITE_KEY", e);
    }
}

import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);

// Initialize App Check with reCAPTCHA v3
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
});

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, appCheck, auth };
