// @ts-check
import { db, auth, firebaseInitialized } from "../firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { logger } from "../logger.js";
import { getCachedMaskedIp } from "../utils.js";
import { getCachedComments, setCachedComments } from "./cache.js";
import { containsBadWord } from "./badwords.js";
import { processCommentText } from "./textProcessor.js";
import { fetchBatchVotes, renderVoteButtons, getVoteCounts } from "../votes.js";
import { getUserLevelIcon, maskIdentifier } from "../utils.js";

const TTL_DAYS = 90;
const ENABLE_IP_DELETE = true;

let isAdmin = false;
firebaseInitialized.then(() => {
  if (auth) {
    onAuthStateChanged(auth, (user) => {
      isAdmin = !!user;
      logger.log("Auth", `관리자 상태: ${isAdmin ? "로그인됨" : "비로그인"}`);
    });
  }
});

export const getIsAdmin = () => isAdmin;

/**
 * Loads comments for a specific item.
 * @param {number|string} itemId - The item ID.
 * @param {boolean} [forceRefresh=false] - Whether to force a refresh from the server.
 * @returns {Promise<void>}
 */
export const loadComments = async (itemId, forceRefresh = false) => {
  try {
    await firebaseInitialized;
    if (!db) throw new Error("Firebase DB not initialized");
  } catch (e) {
    logger.error("Comments", "Firebase 초기화 실패:", e.message);
    const container = document.getElementById(`comments-list-${itemId}`);
    if (container)
      container.innerHTML =
        '<div class="error-comments">서비스 연결 실패</div>';
    return;
  }

  const numericId = Number(itemId);

  if (!itemId || isNaN(numericId)) {
    logger.error("Comments", "Invalid itemId:", itemId);
    return;
  }

  const container = document.getElementById(`comments-list-${itemId}`);
  if (!container) return;

  if (!forceRefresh) {
    const cached = getCachedComments(numericId);
    if (cached) {
      logger.log("Cache", `댓글 캐시 로드: ${numericId}`);
      container.innerHTML = cached.html;
      // Fetch votes in background to update UI
      const commentIds = Array.from(
        container.querySelectorAll(".comment-item"),
      ).map((el) => /** @type {HTMLElement} */(el).dataset.id);
      if (commentIds.length > 0) {
        fetchBatchVotes(commentIds);
      }
      return;
    }
  }

  const skeletonHtml = `
        <div class="skeleton-comment">
            <div class="skeleton-header">
                <div class="skeleton skeleton-avatar"></div>
                <div class="skeleton skeleton-date"></div>
            </div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
        </div>
        <div class="skeleton-comment">
            <div class="skeleton-header">
                <div class="skeleton skeleton-avatar"></div>
                <div class="skeleton skeleton-date"></div>
            </div>
            <div class="skeleton skeleton-text"></div>
        </div>
    `;
  container.innerHTML = skeletonHtml;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TTL_DAYS);

    logger.log("Comments", `댓글 로드: itemId=${numericId}`);

    const q = query(
      collection(db, "comments"),
      where("itemId", "==", numericId),
      where("createdAt", ">", Timestamp.fromDate(cutoffDate)),
      orderBy("createdAt", "desc"),
      limit(30),
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      container.innerHTML =
        '<div class="no-comments">첫 번째 이정표를 남겨보세요!</div>';
      return;
    }

    const allowedDomains = [
      "youtube.com",
      "youtu.be",
      "www.youtube.com",
      "m.youtube.com",
      "wwm.tips",
      "www.wwm.tips",
      "cdn.discordapp.com",
      window.location.hostname,
    ];

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    const hasBlockedLink = (text) => {
      if (/^\[sticker:[\s\S]*\]$/.test(text.trim())) return false;

      const urls = text.match(urlRegex);
      if (!urls) return false;

      for (const url of urls) {
        try {
          const urlObj = new URL(url);
          const hostname = urlObj.hostname.toLowerCase();
          const isAllowed = allowedDomains.some(
            (domain) => hostname === domain || hostname.endsWith("." + domain),
          );
          if (!isAllowed) return true;
        } catch (e) {
          continue;
        }
      }
      return false;
    };

    let html = "";
    const comments = [];
    const replies = {};
    const currentUserIp = getCachedMaskedIp();
    const commentIds = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const text = data.text || "";

      if (hasBlockedLink(text) || containsBadWord(text)) {
        logger.log("Filter", `부적절한 댓글 숨김: ${docSnap.id}`);
        return;
      }

      const commentData = {
        id: docSnap.id,
        ...data,
      };

      commentIds.push(docSnap.id);

      if (data.parentId) {
        if (!replies[data.parentId]) replies[data.parentId] = [];
        replies[data.parentId].push(commentData);
      } else {
        comments.push(commentData);
      }
    });

    // Fetch votes for all comments
    if (commentIds.length > 0) {
      await fetchBatchVotes(commentIds);
    }

    Object.values(replies).forEach((arr) =>
      arr.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return aTime - bTime;
      }),
    );

    const renderComment = (data, isReply = false) => {
      const date = data.createdAt?.toDate
        ? new Date(data.createdAt.toDate()).toLocaleDateString()
        : "방금 전";
      const nickname = data.nickname || "익명";
      const replyBtn = isReply
        ? ""
        : `<button class="btn-reply" data-action="show-reply" data-item-id="${itemId}" data-parent-id="${data.id}">↩ 답글</button>`;
      const ipMatch =
        ENABLE_IP_DELETE && currentUserIp && data.ip === currentUserIp;
      const canDelete = isAdmin || ipMatch || data.passwordHash;
      const deleteBtn = canDelete
        ? `<button class="btn-delete-comment" data-action="delete-comment" data-comment-id="${data.id}" data-item-id="${itemId}" data-comment-ip="${data.ip || ""}" title="삭제">🗑️</button>`
        : "";

      const votes = getVoteCounts(data.id);
      const isBlurred = votes.down >= 5 && votes.down > votes.up * 2;
      const blurClass = isBlurred ? "blurred-comment" : "";
      const blurOverlay = isBlurred
        ? '<div class="blur-overlay" data-action="reveal-comment"><span>비추천이 많은 댓글입니다 (클릭하여 보기)</span></div>'
        : "";

      const levelIcon = getUserLevelIcon(data.userLevel);
      const maskedIp = maskIdentifier(data.ip, 'ip');

      return `
                <div class="comment-item ${isReply ? "comment-reply" : ""} ${blurClass}" data-id="${data.id}">
                    ${blurOverlay}
                    <div class="comment-header">
                        <span class="comment-author">${levelIcon}${nickname} <span style="font-size:0.8em; color:#888; font-weight:normal;">(${maskedIp})</span></span>
                        <span class="comment-meta">
                            <span class="comment-date">${date}</span>
                            ${deleteBtn}
                            ${replyBtn}
                        </span>
                    </div>
                    <div class="comment-text">${processCommentText(data.text)}</div>
                    <div class="comment-footer">
                        ${renderVoteButtons(data.id, true)}
                    </div>
                    <div class="reply-form-container" id="reply-form-${data.id}" style="display:none;"></div>
                </div>
            `;
    };

    comments.forEach((comment) => {
      html += renderComment(comment);
      if (replies[comment.id]) {
        replies[comment.id].forEach((reply) => {
          html += renderComment(reply, true);
        });
      }
    });

    const resultHtml =
      html || '<div class="no-comments">첫 번째 이정표를 남겨보세요!</div>';
    setCachedComments(numericId, resultHtml);
    container.innerHTML = resultHtml;
  } catch (error) {
    console.error("Error loading comments:", error);
    container.innerHTML =
      '<div class="error-comments">이정표를 불러올 수 없습니다.</div>';
  }
};
