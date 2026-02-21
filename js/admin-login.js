// @ts-nocheck
/**
 * 관리자 로그인 모듈 - 관리자 인증을 처리합니다.
 * @module admin-login
 */

import { auth, firebaseInitialized } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

/**
 * 관리자 로그인 페이지를 초기화합니다.
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
   * 로그인을 위한 엔터 키 누름을 처리합니다.
   * @param {KeyboardEvent} e - 키보드 이벤트.
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
