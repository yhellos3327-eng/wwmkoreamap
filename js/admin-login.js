// @ts-nocheck
/**
 * @fileoverview Admin login module - handles administrator authentication.
 * @module admin-login
 */

import { auth, firebaseInitialized } from "./firebase-config.js";
// @ts-ignore - Firebase CDN modules don't have TypeScript definitions
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

/**
 * Initializes the admin login page.
 * @returns {Promise<void>}
 */
const init = async () => {
  await firebaseInitialized;

  const emailInput = /** @type {HTMLInputElement} */ (
    document.getElementById("email")
  );
  const passwordInput = /** @type {HTMLInputElement} */ (
    document.getElementById("password")
  );
  const loginBtn = /** @type {HTMLButtonElement} */ (
    document.getElementById("btn-login")
  );
  const logoutBtn = /** @type {HTMLButtonElement} */ (
    document.getElementById("btn-logout")
  );

  const loginView = /** @type {HTMLElement} */ (
    document.getElementById("login-view")
  );
  const logoutView = /** @type {HTMLElement} */ (
    document.getElementById("logout-view")
  );

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginView.style.display = "none";
      logoutView.style.display = "block";
    } else {
      loginView.style.display = "block";
      logoutView.style.display = "none";
    }
  });

  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
      alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "로그인 중...";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // alert("관리자로 로그인되었습니다.");
      window.location.href = "/admin-dashboard.html";
    } catch (error) {
      console.error("Login failed:", error);
      let msg = "로그인 실패: " + error.message;
      if (error.code === "auth/invalid-credential") {
        msg = "이메일 또는 비밀번호가 올바르지 않습니다.";
      } else if (error.code === "auth/invalid-email") {
        msg = "유효하지 않은 이메일 형식입니다.";
      }
      alert(msg);
      loginBtn.disabled = false;
      loginBtn.textContent = "로그인";
    }
  });

  logoutBtn.addEventListener("click", async () => {
    if (!confirm("로그아웃 하시겠습니까?")) return;

    try {
      await signOut(auth);
      alert("로그아웃되었습니다.");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("로그아웃 실패: " + error.message);
    }
  });

  /**
   * Handles Enter key press for login.
   * @param {KeyboardEvent} e - The keyboard event.
   */
  const handleEnter = (e) => {
    if (e.key === "Enter") {
      loginBtn.click();
    }
  };
  emailInput.addEventListener("keypress", handleEnter);
  passwordInput.addEventListener("keypress", handleEnter);
};

init();
