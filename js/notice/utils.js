// notice/utils.js - 유틸리티 함수

export const formatAuthor = (author) => {
    if (author === '관리자') {
        return `<span class="admin-text">관리자</span>`;
    }
    return author || '익명';
};
