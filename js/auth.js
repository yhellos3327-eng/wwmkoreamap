// @ts-check
import { BACKEND_URL } from "./config.js";
import { initSync, cleanupRealtimeSync } from "./sync.js";

/**
 * @typedef {Object} User
 * @property {string} id - 사용자 ID
 * @property {string} name - 사용자 이름
 * @property {string} email - 사용자 이메일
 * @property {string} provider - 인증 제공자 (google, kakao 등)
 * @property {string} [avatar] - 사용자 아바타 URL
 * @property {boolean} [isAdmin] - 관리자 여부
 */

/** @type {User | null} */
let currentUser = null;

/**
 * 현재 환경이 로컬 개발 환경인지 확인합니다.
 * @returns {boolean} localhost 또는 로컬 IP인 경우 true.
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
 * 사용자가 현재 로그인 상태인지 확인합니다.
 * @returns {boolean} 로그인한 경우 true.
 */
export const isLoggedIn = () => {
  return currentUser !== null;
};

/**
 * 현재 로그인된 사용자를 가져옵니다.
 * @returns {User | null} 현재 사용자 객체 또는 null.
 */
export const getCurrentUser = () => {
  return currentUser;
};

export const isAdminUser = () => {
  return currentUser?.isAdmin || false;
};

/**
 * 현재 인증 토큰을 가져옵니다 (firebase인 경우).
 * @returns {Promise<string|null>} 토큰 또는 null.
 */
export const getAuthToken = async () => {
  if (currentUser?.provider === "firebase") {
    try {
      const { auth } = await import("./firebase-config.js");
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
      }
    } catch (e) {
      console.warn("Failed to get firebase token", e);
    }
  }
  return null;
};

/**
 * 백엔드와 인증 상태를 확인합니다.
 * 해당하는 경우 로컬 개발 테스트 사용자를 처리합니다.
 * @returns {Promise<void>}
 */
const checkAuthStatus = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/user`, {
      credentials: "include",
    });

    if (response.ok) {
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
        return;
      }
    }
  } catch (error) {
    console.warn("Backend auth check failed, checking firebase/local...", error);
  }

  // 로컬 개발을 위한 폴백
  if (isLocalDev()) {
    const { primaryDb } = await import("./storage/db.js");
    const testData = await primaryDb.get("wwm_test_user");
    if (testData) {
      currentUser = testData;
    } else {
      currentUser = null;
    }
    return;
  }

  currentUser = null;
};

/**
 * 특정 제공자로 로그인을 시작합니다.
 * @param {string} provider - 인증 제공자 ('google', 'kakao' 등)
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
  }
  window.location.href = `${BACKEND_URL}/auth/${provider}`;
};

/**
 * 로컬 개발을 위한 테스트 로그인을 수행합니다.
 * @returns {Promise<void>}
 */
export const testLogin = async () => {
  if (!isLocalDev()) {
    console.warn("Test login is only available in local development.");
    return;
  }

  const testUser = {
    id: "test-user-123",
    name: "테스트 사용자 (Admin)",
    email: "test@example.com",
    provider: "test",
    isAdmin: true,
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
 * 현재 사용자를 로그아웃합니다.
 * @returns {Promise<void>}
 */
export const logout = async () => {
  cleanupRealtimeSync();

  try {
    const { auth, firebaseInitialized } = await import("./firebase-config.js");
    await firebaseInitialized;
    if (auth && auth.currentUser) {
      await auth.signOut();
      console.log("[Auth] Signed out from Firebase key");
    }
  } catch (e) {
    console.warn("[Auth] Firebase signout attempt failed", e);
  }

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
 * 인증 상태에 따라 UI를 업데이트합니다.
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

  // 클라우드 백업 섹션 표시 여부 업데이트 (존재하는 경우)
  import("./settings/backup.js").then((m) => {
    m.refreshCloudBackupVisibility();
  }).catch(() => { });
};

/**
 * 인증 모듈을 초기화합니다.
 * @returns {Promise<void>}
 */
export async function initAuth() {
  await checkAuthStatus();

  if (isLoggedIn()) {
    await initSync();
    import("./map/community.js").then(({ fetchUserCompletions }) => {
      fetchUserCompletions();
    }).catch(() => { });
  }
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
