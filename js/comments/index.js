// @ts-check
/// <reference path="../types.d.ts" />
import { fetchUserIp } from "../utils.js";
import { scheduleCleanup } from "./cleanup.js";
import { loadComments } from "./loader.js";
import {
  submitAnonymousComment,
  showReplyForm,
  hideReplyForm,
  submitReply,
  deleteComment,
} from "./actions.js";
import { toggleStickerModal } from "./stickers.js";
import { clearAllCache } from "./cache.js";

fetchUserIp(true);

scheduleCleanup();

export {
  loadComments,
  submitAnonymousComment,
  toggleStickerModal,
  showReplyForm,
  hideReplyForm,
  submitReply,
  deleteComment,
  clearAllCache as clearCommentsCache,
};

/** @type {any} */ (window).showReplyForm = showReplyForm;
/** @type {any} */ (window).hideReplyForm = hideReplyForm;
/** @type {any} */ (window).submitReply = submitReply;
/** @type {any} */ (window).deleteComment = deleteComment;

document.addEventListener("click", (e) => {
  const target = /** @type {HTMLElement} */ (e.target).closest("[data-action]");
  if (!target) return;

  const action = /** @type {HTMLElement} */ (target).dataset.action;

  switch (action) {
    case "show-reply":
      e.stopPropagation();
      showReplyForm(
        /** @type {HTMLElement} */ (target).dataset.itemId,
        /** @type {HTMLElement} */ (target).dataset.parentId,
      );
      break;
    case "hide-reply":
      e.stopPropagation();
      hideReplyForm(/** @type {HTMLElement} */ (target).dataset.parentId);
      break;
    case "delete-comment":
      e.stopPropagation();
      deleteComment(
        /** @type {HTMLElement} */ (target).dataset.commentId,
        /** @type {HTMLElement} */ (target).dataset.itemId,
        /** @type {HTMLElement} */ (target).dataset.commentIp,
      );
      break;
    case "reveal-comment":
      e.stopPropagation();
      const commentItem = target.closest(".comment-item");
      if (commentItem) {
        commentItem.classList.remove("blurred-comment");
        target.remove();
      }
      break;
  }
});

document.addEventListener("submit", (e) => {
  const form = /** @type {HTMLElement} */ (e.target).closest(".reply-form");
  if (
    form &&
    /** @type {HTMLElement} */ (form).dataset.itemId &&
    /** @type {HTMLElement} */ (form).dataset.parentId
  ) {
    e.preventDefault();
    submitReply(
      e,
      /** @type {HTMLElement} */ (form).dataset.itemId,
      /** @type {HTMLElement} */ (form).dataset.parentId,
    );
  }
});
