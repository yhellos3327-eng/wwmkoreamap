// notice/state.js - 상태 관리

export let currentNoticeId = null;
export let currentPostId = null;
export let currentReportId = null;
export let editingSystemUpdateId = null;
export let editingTranslationUpdateId = null;
export let isAdmin = false;

export const setCurrentNoticeId = (id) => { currentNoticeId = id; };
export const setCurrentPostId = (id) => { currentPostId = id; };
export const setCurrentReportId = (id) => { currentReportId = id; };
export const setEditingSystemUpdateId = (id) => { editingSystemUpdateId = id; };
export const setEditingTranslationUpdateId = (id) => { editingTranslationUpdateId = id; };
export const setIsAdmin = (value) => { isAdmin = value; };
