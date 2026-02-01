// @ts-check
import { BACKEND_URL } from "./config.js";
import { initSync, cleanupRealtimeSync } from "./sync.js";

/**
 * @typedef {Object} User
 * @property {string} id - User ID
 * @property {string} name - User name
 * @property {string} email - User email
 * @property {string} provider - Auth provider (google, kakao, etc.)
 * @property {string} [avatar] - User avatar URL
 * @property {boolean} [isAdmin] - Whether user is admin
 */

/** @type {User | null} */
let currentUser = null;

/**
 * Checks if the current environment is local development.
 * @returns {boolean} True if localhost or local IP.
 */
const isLocalDev = () => {
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.includes(".local")
  );
};

/**
 * Checks if the user is currently logged in.
 * @returns {boolean} True if logged in.
 */
export const isLoggedIn = () => {
  return currentUser !== null;
};

/**
 * Gets the current logged-in user.
 * @returns {User | null} The current user object or null.
 */
export const getCurrentUser = () => {
  return currentUser;
};

/**
 * Checks if the current user is an admin.
 * @returns {boolean} True if admin.
 */
export const isAdminUser = () => {
  return currentUser?.isAdmin || false;
};

/**
 * Checks the authentication status with the backend.
 * Handles local dev test user if applicable.
 * @returns {Promise<void>}
 */
const checkAuthStatus = async () => {
  if (isLocalDev()) {
    const { primaryDb } = await import("./storage/db.js");
    const testData = await primaryDb.get("wwm_test_user");
    if (testData) {
      currentUser = testData;
    }
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/user`, {
      credentials: "include",
    });

    const data = await response.json();

    if (data.isAuthenticated && data.user) {
      currentUser = {
        id: data.user.id,
        name: data.user.name || data.user.display_name || "사용자",
        email: data.user.email,
        provider: data.user.provider,
        avatar: data.user.profileImage,
        isAdmin: data.isAdmin,
      };
    } else {
      currentUser = null;
    }
  } catch (error) {
    console.error("Failed to check auth status:", error);
    currentUser = null;
  }
};

/**
 * Initiates login with a specific provider.
 * @param {string} provider - The auth provider ('google', 'kakao', etc.)
 */
export const loginWithProvider = async (provider) => {
  if (isLocalDev()) {
    console.warn(
      "OAuth login is not available in local development. Use test login instead.",
    );
    alert(
      "로컬 환경에서는 OAuth 로그인이 불가능합니다.\n테스트 로그인을 사용해주세요.",
    );
    return;
  }

  const { primaryDb } = await import("./storage/db.js");
  const result = await primaryDb.set("wwm_auth_return_url", window.location.href);
  if (!result || !result.success) {
    console.error("Failed to set return URL", result);
    // Proceed anyway as it's not critical, or show error? 
    // For now, we log it.
  }
  window.location.href = `${BACKEND_URL}/auth/${provider}`;
};

/**
 * Performs a test login for local development.
 * @returns {Promise<void>}
 */
export const testLogin = async () => {
  if (!isLocalDev()) {
    console.warn("Test login is only available in local development.");
    return;
  }

  const testUser = {
    id: "test-user-123",
    name: "테스트 사용자",
    email: "test@example.com",
    provider: "test",
  };

  const { primaryDb } = await import("./storage/db.js");
  const result = await primaryDb.set("wwm_test_user", testUser);
  if (!result || !result.success) {
    console.error("Failed to save test user", result);
    alert("테스트 로그인 정보 저장 실패");
    return;
  }
  currentUser = testUser;

  console.log("Test login successful:", testUser);
  updateAuthUI();

  await initSync();
};

/**
 * Logs out the current user.
 * @returns {Promise<void>}
 */
export const logout = async () => {
  cleanupRealtimeSync();

  if (isLocalDev()) {
    const { primaryDb } = await import("./storage/db.js");
    const result = await primaryDb.delete("wwm_test_user");
    if (!result || !result.success) {
      console.error("Failed to delete test user", result);
    }
    currentUser = null;
    updateAuthUI();
    return;
  }

  window.location.href = `${BACKEND_URL}/auth/logout`;
};

/**
 * Updates the UI based on the authentication state.
 */
export const updateAuthUI = () => {
  const loggedOutSection = document.getElementById("auth-logged-out");
  const loggedInSection = document.getElementById("auth-logged-in");
  const localDevSection = document.getElementById("local-dev-auth");

  const loggedIn = isLoggedIn();
  const user = getCurrentUser();

  if (loggedOutSection && loggedInSection) {
    loggedOutSection.style.display = loggedIn ? "none" : "block";
    loggedInSection.style.display = loggedIn ? "flex" : "none";
  }

  if (localDevSection) {
    localDevSection.style.display =
      isLocalDev() && !loggedIn ? "block" : "none";
  }

  if (loggedIn && user) {
    /** @type {HTMLImageElement | null} */
    const avatarEl = /** @type {HTMLImageElement | null} */ (
      document.getElementById("auth-user-avatar")
    );
    const nameEl = document.getElementById("auth-user-name");
    const providerEl = document.getElementById("auth-user-provider");

    if (avatarEl) {
      avatarEl.src =
        user.avatar || "https://via.placeholder.com/40/333/fff?text=?";
      avatarEl.onerror = () => {
        avatarEl.src = "https://via.placeholder.com/40/333/fff?text=?";
      };
    }
    if (nameEl) nameEl.textContent = user.name || "사용자";
    if (providerEl) {
      const providerNames = {
        google: "Google",
        kakao: "Kakao",
        test: "Test Mode",
      };
      providerEl.textContent =
        providerNames[user.provider] || user.provider || "";
    }
  }

  // Update cloud backup section visibility if it exists
  import("./settings/backup.js").then((m) => {
    m.refreshCloudBackupVisibility();
  }).catch(() => { });
};

/**
 * Initializes the authentication module.
 * @returns {Promise<void>}
 */
export const initAuth = async () => {
  await checkAuthStatus();

  if (isLoggedIn()) {
    await initSync();
    // Sync completion status from dedicated backend table
    import("./map/community.js").then(({ fetchUserCompletions }) => {
      fetchUserCompletions();
    }).catch(() => { });
  }

  const kakaoBtn = document.getElementById("btn-kakao-login");
  const googleBtn = document.getElementById("btn-google-login");
  const testBtn = document.getElementById("btn-test-login");
  const logoutBtn = document.getElementById("btn-logout");

  if (kakaoBtn) {
    kakaoBtn.addEventListener("click", () => loginWithProvider("kakao"));
  }

  if (googleBtn) {
    googleBtn.addEventListener("click", () => loginWithProvider("google"));
  }

  if (testBtn) {
    testBtn.addEventListener("click", testLogin);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  updateAuthUI();

  console.log("[Auth] Initialized", {
    isLocalDev: isLocalDev(),
    isLoggedIn: isLoggedIn(),
    user: getCurrentUser(),
  });
};
