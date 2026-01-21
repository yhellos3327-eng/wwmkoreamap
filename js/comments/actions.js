// @ts-check
/// <reference path="../types.d.ts" />
import { db, firebaseInitialized } from "../firebase-config.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { logger } from "../logger.js";
import { fetchUserIp, getCachedMaskedIp } from "../utils.js";
import { invalidateCache } from "./cache.js";
import { containsBadWord } from "./badwords.js";
import { loadComments, getIsAdmin } from "./loader.js";

const TTL_DAYS = 90;
const ENABLE_IP_DELETE = true;

/**
 * Calculates the expiration date for a comment.
 * @returns {Timestamp} The expiration timestamp.
 */
const getExpireAt = () => {
  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + TTL_DAYS);
  return Timestamp.fromDate(expireDate);
};

/**
 * Hashes a password using SHA-256.
 * @param {string} password - The password to hash.
 * @returns {Promise<string>} The hashed password.
 */
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "wwm_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Submits an anonymous comment.
 * @param {Event} event - The form submission event.
 * @param {string|number} itemId - The ID of the item being commented on.
 */
export const submitAnonymousComment = async (event, itemId) => {
  event.preventDefault();
  try {
    await firebaseInitialized;
    if (!db) throw new Error("Firebase DB not initialized");
  } catch (e) {
    alert("서비스 연결에 실패했습니다.");
    return;
  }

  const numericId = Number(itemId);
  if (isNaN(numericId)) {
    console.error("[Comments] Invalid itemId for submission:", itemId);
    return;
  }

  const form = /** @type {HTMLFormElement} */ (event.target);
  const input = /** @type {HTMLInputElement} */ (
    form.querySelector(".comment-input")
  );
  const nicknameInput = /** @type {HTMLInputElement} */ (
    form.querySelector(".comment-nickname")
  );
  const text = input.value.trim();
  const nickname = nicknameInput ? nicknameInput.value.trim() : "익명";

  if (!text) return;
  if (containsBadWord(text) || containsBadWord(nickname)) {
    alert("부적절한 표현이 포함되어 있습니다.");
    return;
  }

  const btn = form.querySelector("button");
  const originalBtnText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "...";

  try {
    const maskedIp = await fetchUserIp(true);

    const passwordInput = /** @type {HTMLInputElement} */ (
      form.querySelector(".comment-password")
    );
    const password = passwordInput ? passwordInput.value.trim() : "";
    let passwordHash = null;
    if (password) {
      logger.log(
        "Save",
        `저장 비밀번호 길이: ${password.length}, 첫글자 코드: ${password.charCodeAt(0)}`,
      );
      passwordHash = await hashPassword(password);
      logger.log("Save", `저장 해시: ${passwordHash.substring(0, 16)}...`);
    }

    await addDoc(collection(db, "comments"), {
      itemId: numericId,
      text: text,
      nickname: nickname || "익명",
      ip: maskedIp,
      passwordHash: passwordHash,
      createdAt: serverTimestamp(),
      expireAt: getExpireAt(),
      isAnonymous: true,
    });

    input.value = "";
    invalidateCache(numericId);
    loadComments(itemId, true);
  } catch (error) {
    console.error("Error adding comment:", error);
    alert("코멘트 등록에 실패했습니다.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalBtnText;
  }
};

/**
 * Shows the reply form for a specific comment.
 * @param {string|number} itemId - The item ID.
 * @param {string} parentId - The parent comment ID.
 */
export const showReplyForm = (itemId, parentId) => {
  document.querySelectorAll(".reply-form-container").forEach((el) => {
    /** @type {HTMLElement} */ (el).style.display = "none";
    el.innerHTML = "";
  });

  const container = document.getElementById(`reply-form-${parentId}`);
  if (!container) return;

  container.style.display = "block";
  container.innerHTML = `
        <form class="reply-form" data-item-id="${itemId}" data-parent-id="${parentId}">
            <div class="reply-input-group">
                <input type="text" class="reply-nickname" placeholder="닉네임" maxlength="10">
                <input type="password" class="reply-password" placeholder="비번" maxlength="16" title="삭제 시 필요">
                <input type="text" class="reply-input" placeholder="답글 입력..." maxlength="200" required>
                <button type="submit" class="reply-submit">답글</button>
                <button type="button" class="reply-cancel" data-action="hide-reply" data-parent-id="${parentId}">취소</button>
            </div>
        </form>
    `;
  /** @type {HTMLInputElement} */ (
    container.querySelector(".reply-input")
  ).focus();
};

/**
 * Hides the reply form.
 * @param {string} parentId - The parent comment ID.
 */
export const hideReplyForm = (parentId) => {
  const container = document.getElementById(`reply-form-${parentId}`);
  if (container) {
    container.style.display = "none";
    container.innerHTML = "";
  }
};

/**
 * Submits a reply to a comment.
 * @param {Event} event - The form submission event.
 * @param {string|number} itemId - The item ID.
 * @param {string} parentId - The parent comment ID.
 */
export const submitReply = async (event, itemId, parentId) => {
  event.preventDefault();
  try {
    await firebaseInitialized;
    if (!db) throw new Error("Firebase DB not initialized");
  } catch (e) {
    alert("서비스 연결에 실패했습니다.");
    return;
  }

  const numericId = Number(itemId);

  const form = /** @type {HTMLFormElement} */ (event.target);
  const input = /** @type {HTMLInputElement} */ (
    form.querySelector(".reply-input")
  );
  const nicknameInput = /** @type {HTMLInputElement} */ (
    form.querySelector(".reply-nickname")
  );
  const text = input.value.trim();
  const nickname = nicknameInput ? nicknameInput.value.trim() : "익명";

  if (!text) return;

  if (containsBadWord(text) || containsBadWord(nickname)) {
    alert("부적절한 표현이 포함되어 있습니다.");
    return;
  }

  const btn = /** @type {HTMLButtonElement} */ (
    form.querySelector(".reply-submit")
  );
  btn.disabled = true;
  btn.textContent = "...";

  try {
    const maskedIp = await fetchUserIp(true);

    const passwordInput = /** @type {HTMLInputElement} */ (
      form.querySelector(".reply-password")
    );
    const password = passwordInput ? passwordInput.value.trim() : "";
    let passwordHash = null;
    if (password) {
      passwordHash = await hashPassword(password);
    }

    await addDoc(collection(db, "comments"), {
      itemId: numericId,
      parentId: parentId,
      text: text,
      nickname: nickname || "익명",
      ip: maskedIp,
      passwordHash: passwordHash,
      createdAt: serverTimestamp(),
      expireAt: getExpireAt(),
      isAnonymous: true,
    });

    invalidateCache(numericId);
    loadComments(itemId, true);
  } catch (error) {
    console.error("Error adding reply:", error);
    alert("답글 등록에 실패했습니다.");
  }
};

/**
 * Deletes a comment.
 * @param {string} commentId - The ID of the comment to delete.
 * @param {string|number} itemId - The item ID.
 * @param {string} commentIp - The masked IP of the comment author.
 */
export const deleteComment = async (commentId, itemId, commentIp) => {
  const isAdmin = getIsAdmin();
  const currentUserIp = getCachedMaskedIp();

  if (isAdmin) {
    if (!confirm("관리자 권한으로 이 댓글을 삭제하시겠습니까?")) return;

    try {
      await firebaseInitialized;
      if (!db) throw new Error("Firebase DB not initialized");

      const commentRef = doc(db, "comments", commentId);
      await deleteDoc(commentRef);
      invalidateCache(Number(itemId));
      loadComments(itemId, true);
      logger.success("Comments", `[관리자] 댓글 삭제 완료: ${commentId}`);
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("댓글 삭제에 실패했습니다.");
    }
    return;
  }

  logger.log(
    "Delete",
    `IP Check - Comment: ${commentIp}, Current: ${currentUserIp}, Enabled: ${ENABLE_IP_DELETE}`,
  );

  if (
    ENABLE_IP_DELETE &&
    commentIp &&
    currentUserIp &&
    commentIp === currentUserIp
  ) {
    if (
      confirm(
        "작성자 IP가 일치합니다.\n비밀번호 없이 즉시 삭제하시겠습니까?\n(취소 시 비밀번호 입력)",
      )
    ) {
      try {
        await firebaseInitialized;
        if (!db) throw new Error("Firebase DB not initialized");

        const commentRef = doc(db, "comments", commentId);
        await deleteDoc(commentRef);
        invalidateCache(Number(itemId));
        loadComments(itemId, true);
        logger.success("Comments", `[IP 일치] 댓글 삭제 완료: ${commentId}`);
        return;
      } catch (error) {
        console.error("Error deleting comment:", error);
        if (
          !confirm(
            "IP 인증 삭제에 실패했습니다. (권한 부족)\n비밀번호를 입력하여 삭제하시겠습니까?",
          )
        ) {
          return;
        }
      }
    }
  }

  const password = prompt("삭제하려면 작성 시 입력한 비밀번호를 입력하세요.");
  if (!password || !password.trim()) return;

  const trimmedPassword = password.trim();

  try {
    await firebaseInitialized;
    if (!db) throw new Error("Firebase DB not initialized");

    const commentRef = doc(db, "comments", commentId);
    const commentSnap = await getDoc(commentRef);

    if (!commentSnap.exists()) {
      alert("댓글을 찾을 수 없습니다.");
      return;
    }

    const commentData = commentSnap.data();
    const inputHash = await hashPassword(trimmedPassword);

    if (commentData.passwordHash !== inputHash) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }

    await deleteDoc(commentRef);
    invalidateCache(Number(itemId));
    loadComments(itemId, true);
    logger.success("Comments", `댓글 삭제 완료: ${commentId}`);
  } catch (error) {
    console.error("Error deleting comment:", error);
    alert("댓글 삭제에 실패했습니다.");
  }
};
