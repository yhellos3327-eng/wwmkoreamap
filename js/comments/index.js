import { fetchUserIp } from '../utils.js';
import { scheduleCleanup } from './cleanup.js';
import { loadComments } from './loader.js';
import {
    submitAnonymousComment,
    showReplyForm,
    hideReplyForm,
    submitReply,
    deleteComment
} from './actions.js';
import { toggleStickerModal } from './stickers.js';
import { clearAllCache } from './cache.js';

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
    clearAllCache as clearCommentsCache
};

window.showReplyForm = showReplyForm;
window.hideReplyForm = hideReplyForm;
window.submitReply = submitReply;
window.deleteComment = deleteComment;

document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    switch (action) {
        case 'show-reply':
            e.stopPropagation();
            showReplyForm(target.dataset.itemId, target.dataset.parentId);
            break;
        case 'hide-reply':
            e.stopPropagation();
            hideReplyForm(target.dataset.parentId);
            break;
        case 'delete-comment':
            e.stopPropagation();
            deleteComment(target.dataset.commentId, target.dataset.itemId, target.dataset.commentIp);
            break;
    }
});

document.addEventListener('submit', (e) => {
    const form = e.target.closest('.reply-form');
    if (form && form.dataset.itemId && form.dataset.parentId) {
        e.preventDefault();
        submitReply(e, form.dataset.itemId, form.dataset.parentId);
    }
});
