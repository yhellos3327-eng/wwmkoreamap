// @ts-check
/**
 * @fileoverview Comments module - re-exports comment functionality.
 * @module comments
 */

export {
  loadComments,
  submitAnonymousComment,
  toggleStickerModal,
  showReplyForm,
  hideReplyForm,
  submitReply,
  deleteComment,
  clearCommentsCache,
} from "./comments/index.js";
