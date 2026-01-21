import { auth, firebaseInitialized } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import { setIsAdmin, isAdmin } from "./notice/state.js";
import { initTabs } from "./notice/tabs.js";
import { initBoardEvents } from "./notice/notices.js";
import {
  renderFreeBoardPosts,
  initFreeBoardEvents,
} from "./notice/freeboard.js";

const init = async () => {
  await firebaseInitialized;

  onAuthStateChanged(auth, (user) => {
    const postAuthorInput = document.getElementById("post-author");

    const adminBtns = document.querySelectorAll(".admin-only");

    if (user) {
      setIsAdmin(true);
      document.getElementById("btn-login").textContent = "🔓 로그아웃";
      document.body.classList.add("admin-mode");

      adminBtns.forEach((btn) => (btn.style.display = "block"));

      if (postAuthorInput) {
        postAuthorInput.value = "관리자";
        postAuthorInput.disabled = true;
        postAuthorInput.classList.add("admin-text");
      }
    } else {
      setIsAdmin(false);
      document.getElementById("btn-login").textContent = "🔒 관리자 로그인";
      document.body.classList.remove("admin-mode");

      adminBtns.forEach((btn) => (btn.style.display = "none"));

      if (postAuthorInput) {
        postAuthorInput.value = "";
        postAuthorInput.disabled = false;
        postAuthorInput.classList.remove("admin-text");
      }
    }

    renderFreeBoardPosts();
  });

  initLoginEvents();

  initTabs();
  initBoardEvents();
  initFreeBoardEvents();
};

const initLoginEvents = () => {
  const loginModal = document.getElementById("login-modal");
  const btnLogin = document.getElementById("btn-login");
  const btnPerformLogin = document.getElementById("btn-perform-login");
  const btnCloseLogin = document.getElementById("btn-close-login");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");

  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      if (isAdmin) {
        signOut(auth).then(() => {
          alert("로그아웃되었습니다.");
          window.location.reload();
        });
      } else {
        loginModal.style.display = "flex";
      }
    });
  }

  if (btnCloseLogin) {
    btnCloseLogin.addEventListener("click", () => {
      loginModal.style.display = "none";
    });
  }

  if (btnPerformLogin) {
    btnPerformLogin.addEventListener("click", async () => {
      const email = emailInput.value;
      const password = passwordInput.value;
      try {
        await signInWithEmailAndPassword(auth, email, password);
        loginModal.style.display = "none";
        alert("관리자로 로그인되었습니다.");
      } catch (error) {
        console.error("Login failed:", error);
        alert("로그인 실패: " + error.message);
      }
    });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
