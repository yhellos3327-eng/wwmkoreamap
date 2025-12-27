import { db, firebaseInitialized } from './firebase-config.js';
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, Timestamp, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { logger } from './logger.js';

const TTL_DAYS = 90;

const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'wwm_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

let badWordsList = [];
const BADWORDS_SOURCES = [
    { url: 'https://raw.githubusercontent.com/yoonheyjung/badwords-ko/refs/heads/main/src/badwords.ko.config.json', type: 'json', key: 'badWords' },
    { url: 'https://raw.githubusercontent.com/organization/Gentleman/refs/heads/master/resources/badwords.json', type: 'json', key: 'badwords' },
    { url: './js/badwords/fword_list.txt', type: 'text' }
];

const loadBadWords = async () => {
    const allWords = new Set();

    for (const source of BADWORDS_SOURCES) {
        try {
            const response = await fetch(source.url);

            if (source.type === 'text') {
                const text = await response.text();
                const words = text.split('\n').map(w => w.trim()).filter(w => w);
                words.forEach(word => allWords.add(word.toLowerCase()));
            } else {
                const data = await response.json();
                const words = data[source.key] || [];
                words.forEach(word => allWords.add(word.toLowerCase()));
            }
        } catch (e) {
            logger.warn('BadWords', `소스 로드 실패: ${source.url}`, e.message);
        }
    }

    badWordsList = [...allWords];
    logger.success('BadWords', `${badWordsList.length}개 비속어 로드 완료`);
}

const containsBadWord = (text) => {
    if (!text || badWordsList.length === 0) return false;
    const lowerText = text.toLowerCase();
    return badWordsList.some(word => lowerText.includes(word));
}

loadBadWords();

const getExpireAt = () => {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + TTL_DAYS);
    return Timestamp.fromDate(expireDate);
}

let cleanupRan = false;
const cleanupOldComments = async () => {
    if (cleanupRan) return;
    cleanupRan = true;

    const CLEANUP_COOLDOWN_KEY = 'wwm_cleanup_last_run';
    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const lastRun = localStorage.getItem(CLEANUP_COOLDOWN_KEY);
    if (lastRun && (Date.now() - parseInt(lastRun)) < COOLDOWN_MS) {
        logger.log('Cleanup', '쿨다운 중 - 24시간 내 이미 실행됨');
        return;
    }

    try {
        await firebaseInitialized;
        if (!db) {
            logger.warn('Cleanup', 'Firebase DB 초기화 실패, 정리 건너뛰');
            return;
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - TTL_DAYS);

        const q = query(
            collection(db, "comments"),
            where("createdAt", "<", Timestamp.fromDate(cutoffDate)),
            limit(10)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            localStorage.setItem(CLEANUP_COOLDOWN_KEY, Date.now().toString());
            return;
        }

        logger.log('Cleanup', `${snapshot.size}개 오래된 댓글 삭제 중...`);

        const deletePromises = [];
        snapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, "comments", docSnap.id)));
        });

        await Promise.all(deletePromises);
        localStorage.setItem(CLEANUP_COOLDOWN_KEY, Date.now().toString());
        logger.success('Cleanup', `${snapshot.size}개 오래된 댓글 삭제 완료`);
    } catch (error) {
        logger.warn('Cleanup', '오래된 댓글 삭제 실패:', error.message);
    }
}

setTimeout(() => cleanupOldComments(), 10000);

const commentsCache = new Map();
const CACHE_TTL = 3 * 60 * 1000;

export const loadComments = async (itemId, forceRefresh = false) => {
    try {
        await firebaseInitialized;
        if (!db) throw new Error("Firebase DB not initialized");
    } catch (e) {
        logger.error('Comments', 'Firebase 초기화 실패:', e.message);
        const container = document.getElementById(`comments-list-${itemId}`);
        if (container) container.innerHTML = '<div class="error-comments">서비스 연결 실패</div>';
        return;
    }

    const numericId = Number(itemId);

    if (!itemId || isNaN(numericId)) {
        logger.error('Comments', 'Invalid itemId:', itemId);
        return;
    }

    const container = document.getElementById(`comments-list-${itemId}`);
    if (!container) return;

    const cacheKey = `comment_${numericId}`;
    const cached = commentsCache.get(cacheKey);
    if (!forceRefresh && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        logger.log('Cache', `댓글 캐시 로드: ${numericId}`);
        container.innerHTML = cached.html;
        return;
    }

    container.innerHTML = '<div class="loading-comments">이정표 불러오는 중...</div>';

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - TTL_DAYS);

        logger.log('Comments', `댓글 로드: itemId=${numericId}`);

        const q = query(
            collection(db, "comments"),
            where("itemId", "==", numericId),
            where("createdAt", ">", Timestamp.fromDate(cutoffDate)),
            orderBy("createdAt", "desc"),
            limit(30)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = '<div class="no-comments">첫 번째 이정표를 남겨보세요!</div>';
            return;
        }

        const allowedDomains = [
            'youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com',
            'wwm.tips', 'www.wwm.tips',
            window.location.hostname
        ];

        const urlRegex = /(https?:\/\/[^\s]+)/g;

        const hasBlockedLink = (text) => {
            if (/^\[sticker:.*\]$/.test(text.trim())) return false;

            const urls = text.match(urlRegex);
            if (!urls) return false;

            for (const url of urls) {
                try {
                    const urlObj = new URL(url);
                    const hostname = urlObj.hostname.toLowerCase();
                    const isAllowed = allowedDomains.some(domain =>
                        hostname === domain || hostname.endsWith('.' + domain)
                    );
                    if (!isAllowed) return true;
                } catch (e) {
                    continue;
                }
            }
            return false;
        }

        let html = '';
        const comments = [];
        const replies = {};

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const text = data.text || '';

            if (hasBlockedLink(text) || containsBadWord(text)) {
                logger.log('Filter', `부적절한 댓글 숨김: ${docSnap.id}`);
                return;
            }

            const commentData = {
                id: docSnap.id,
                ...data
            };

            if (data.parentId) {
                if (!replies[data.parentId]) replies[data.parentId] = [];
                replies[data.parentId].push(commentData);
            } else {
                comments.push(commentData);
            }
        });

        Object.values(replies).forEach(arr => arr.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || new Date(0);
            const bTime = b.createdAt?.toDate?.() || new Date(0);
            return aTime - bTime;
        }));

        const renderComment = (data, isReply = false) => {
            const date = data.createdAt?.toDate ? new Date(data.createdAt.toDate()).toLocaleDateString() : '방금 전';
            const nickname = data.nickname || '익명';
            const replyBtn = isReply ? '' : `<button class="btn-reply" data-action="show-reply" data-item-id="${itemId}" data-parent-id="${data.id}">↩ 답글</button>`;
            const deleteBtn = data.passwordHash ? `<button class="btn-delete-comment" data-action="delete-comment" data-comment-id="${data.id}" data-item-id="${itemId}" title="삭제">🗑️</button>` : '';

            return `
                <div class="comment-item ${isReply ? 'comment-reply' : ''}" data-id="${data.id}">
                    <div class="comment-header">
                        <span class="comment-author">${nickname} <span style="font-size:0.8em; color:#888; font-weight:normal;">(${data.ip || '...'})</span></span>
                        <span class="comment-meta">
                            <span class="comment-date">${date}</span>
                            ${deleteBtn}
                            ${replyBtn}
                        </span>
                    </div>
                    <div class="comment-text">${processCommentText(data.text)}</div>
                    <div class="reply-form-container" id="reply-form-${data.id}" style="display:none;"></div>
                </div>
            `;
        }

        comments.forEach(comment => {
            html += renderComment(comment);
            if (replies[comment.id]) {
                replies[comment.id].forEach(reply => {
                    html += renderComment(reply, true);
                });
            }
        });

        const resultHtml = html || '<div class="no-comments">첫 번째 이정표를 남겨보세요!</div>';
        commentsCache.set(cacheKey, {
            html: resultHtml,
            timestamp: Date.now()
        });

        container.innerHTML = resultHtml;

    } catch (error) {
        console.error("Error loading comments:", error);
        container.innerHTML = '<div class="error-comments">이정표를 불러올 수 없습니다.</div>';
    }
}

export const submitAnonymousComment = async (event, itemId) => {
    event.preventDefault();
    try {
        await firebaseInitialized;
        if (!db) throw new Error("Firebase DB not initialized");
    } catch (e) {
        alert('서비스 연결에 실패했습니다.');
        return;
    }

    const numericId = Number(itemId);
    if (isNaN(numericId)) {
        console.error("[Comments] Invalid itemId for submission:", itemId);
        return;
    }
    const form = event.target;
    const input = form.querySelector('.comment-input');
    const nicknameInput = form.querySelector('.comment-nickname');
    const text = input.value.trim();
    const nickname = nicknameInput ? nicknameInput.value.trim() : '익명';

    if (!text) return;
    if (containsBadWord(text) || containsBadWord(nickname)) {
        alert('부적절한 표현이 포함되어 있습니다.');
        return;
    }

    const btn = form.querySelector('button');
    const originalBtnText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';

    try {
        let ip = 'unknown';
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            ip = data.ip;
        } catch (e) {
            console.warn('Failed to get IP', e);
        }
        const maskedIp = ip.split('.').slice(0, 2).join('.');

        // Get password from form
        const passwordInput = form.querySelector('.comment-password');
        const password = passwordInput ? passwordInput.value.trim() : '';
        let passwordHash = null;
        if (password) {
            passwordHash = await hashPassword(password);
        }

        await addDoc(collection(db, "comments"), {
            itemId: numericId,
            text: text,
            nickname: nickname || '익명',
            ip: maskedIp,
            passwordHash: passwordHash,
            createdAt: serverTimestamp(),
            expireAt: getExpireAt(),
            isAnonymous: true
        });

        input.value = '';
        commentsCache.delete(`comment_${numericId}`);
        loadComments(itemId, true);
    } catch (error) {
        console.error("Error adding comment:", error);
        alert('코멘트 등록에 실패했습니다.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalBtnText;
    }
}

const STICKERS = [
    "https://cdn.discordapp.com/emojis/1372162936679829524.webp?size=256&animated=true",
    "https://cdn.discordapp.com/emojis/1372181011206504530.webp?size=256&animated=true",
    "https://cdn.discordapp.com/emojis/1372180345746620487.webp?size=256&animated=true",
    "https://cdn.discordapp.com/emojis/1372175307095801936.webp?size=256&animated=true",
    "https://cdn.discordapp.com/emojis/1410879033989926963.webp?size=256",
    "https://cdn.discordapp.com/emojis/1447478330432422021.webp?size=256",
    "https://cdn.discordapp.com/emojis/1448678213860458566.webp?size=256",
    "https://cdn.discordapp.com/emojis/1448731853602291835.webp?size=256",
];

export const toggleStickerModal = (itemId) => {
    const modal = document.getElementById(`sticker-modal-${itemId}`);
    const grid = document.getElementById(`sticker-grid-${itemId}`);

    if (!modal || !grid) return;

    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
    } else {
        document.querySelectorAll('.sticker-modal.active').forEach(m => m.classList.remove('active'));
        if (grid.children.length === 0) {
            STICKERS.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.className = 'sticker-item';
                img.onclick = () => selectSticker(itemId, url);
                grid.appendChild(img);
            });
        }
        modal.classList.add('active');
    }
}

const selectSticker = async (itemId, url) => {
    try {
        await firebaseInitialized;
        if (!db) throw new Error("Firebase DB not initialized");
    } catch (e) {
        alert('서비스 연결에 실패했습니다.');
        return;
    }

    const modal = document.getElementById(`sticker-modal-${itemId}`);
    const form = modal.closest('form');
    const nicknameInput = form.querySelector('.comment-nickname');
    const nickname = nicknameInput ? nicknameInput.value.trim() : '익명';

    modal.classList.remove('active');

    const container = document.getElementById(`comments-list-${itemId}`);
    if (container) {
        const tempMsg = document.createElement('div');
        tempMsg.className = 'loading-comments';
        tempMsg.textContent = '스티커 전송 중...';
        container.insertBefore(tempMsg, container.firstChild);
    }

    try {
        let ip = 'unknown';
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            ip = data.ip;
        } catch (e) {
            console.warn('Failed to get IP', e);
        }
        const maskedIp = ip.split('.').slice(0, 2).join('.');

        await addDoc(collection(db, "comments"), {
            itemId: Number(itemId),
            text: `[sticker:${url}]`,
            nickname: nickname || '익명',
            ip: maskedIp,
            createdAt: serverTimestamp(),
            expireAt: getExpireAt(),
            isAnonymous: true
        });

        commentsCache.delete(`comment_${Number(itemId)}`);
        loadComments(itemId, true);
    } catch (error) {
        console.error("Error sending sticker:", error);
        alert('스티커 전송에 실패했습니다.');
        loadComments(itemId, true);
    }
}

const processCommentText = (text) => {
    if (!text) return text;
    let processed = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const stickers = [];
    processed = processed.replace(/\[sticker:(.*?)\]/g, (match, url) => {
        stickers.push(`<img src="${url}" class="comment-sticker" alt="sticker">`);
        return `[[STICKER_${stickers.length - 1}]]`;
    });

    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    processed = processed.replace(/~~(.*?)~~/g, '<del>$1</del>');
    processed = processed.replace(/__(.*?)__/g, '<u>$1</u>');
    processed = processed.replace(/\[color:([a-zA-Z0-9#]+)\](.*?)\[\/c\]/g, (match, color, content) => {
        return `<span style="color:${color}">${content}</span>`;
    });

    const allowedDomains = [
        'youtube.com',
        'youtu.be',
        'www.youtube.com',
        'm.youtube.com',
        'wwm.tips',
        'www.wwm.tips',
        window.location.hostname
    ];

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    processed = processed.replace(urlRegex, (url) => {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const isAllowed = allowedDomains.some(domain =>
                hostname === domain || hostname.endsWith('.' + domain)
            );
            if (isAllowed) {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="comment-link">${url}</a>`;
            } else {
                return `<span class="blocked-link" title="허용되지 않은 링크">[링크 차단됨]</span>`;
            }
        } catch (e) {
            return url;
        }
    });

    processed = processed.replace(/\[\[STICKER_(\d+)\]\]/g, (match, index) => {
        return stickers[parseInt(index)];
    });

    return processed;
}

// Global assignments removed

const showReplyForm = (itemId, parentId) => {
    document.querySelectorAll('.reply-form-container').forEach(el => {
        el.style.display = 'none';
        el.innerHTML = '';
    });

    const container = document.getElementById(`reply-form-${parentId}`);
    if (!container) return;

    container.style.display = 'block';
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
    container.querySelector('.reply-input').focus();
}

const hideReplyForm = (parentId) => {
    const container = document.getElementById(`reply-form-${parentId}`);
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

const submitReply = async (event, itemId, parentId) => {
    event.preventDefault();
    try {
        await firebaseInitialized;
        if (!db) throw new Error("Firebase DB not initialized");
    } catch (e) {
        alert('서비스 연결에 실패했습니다.');
        return;
    }

    const numericId = Number(itemId);

    const form = event.target;
    const input = form.querySelector('.reply-input');
    const nicknameInput = form.querySelector('.reply-nickname');
    const text = input.value.trim();
    const nickname = nicknameInput ? nicknameInput.value.trim() : '익명';

    if (!text) return;

    if (containsBadWord(text) || containsBadWord(nickname)) {
        alert('부적절한 표현이 포함되어 있습니다.');
        return;
    }

    const btn = form.querySelector('.reply-submit');
    btn.disabled = true;
    btn.textContent = '...';

    try {
        let ip = 'unknown';
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            ip = data.ip;
        } catch (e) {
            console.warn('Failed to get IP', e);
        }
        const maskedIp = ip.split('.').slice(0, 2).join('.');

        // Get password from reply form
        const passwordInput = form.querySelector('.reply-password');
        const password = passwordInput ? passwordInput.value.trim() : '';
        let passwordHash = null;
        if (password) {
            passwordHash = await hashPassword(password);
        }

        await addDoc(collection(db, "comments"), {
            itemId: numericId,
            parentId: parentId,
            text: text,
            nickname: nickname || '익명',
            ip: maskedIp,
            passwordHash: passwordHash,
            createdAt: serverTimestamp(),
            expireAt: getExpireAt(),
            isAnonymous: true
        });

        commentsCache.delete(`comment_${numericId}`);
        loadComments(itemId, true);
    } catch (error) {
        console.error("Error adding reply:", error);
        alert('답글 등록에 실패했습니다.');
    }
}

// Delete comment with password verification
const deleteComment = async (commentId, itemId) => {
    const password = prompt('삭제하려면 작성 시 입력한 비밀번호를 입력하세요:');
    if (!password) return;

    try {
        await firebaseInitialized;
        if (!db) throw new Error("Firebase DB not initialized");

        const commentRef = doc(db, "comments", commentId);
        const commentSnap = await getDoc(commentRef);

        if (!commentSnap.exists()) {
            alert('댓글을 찾을 수 없습니다.');
            return;
        }

        const commentData = commentSnap.data();
        const inputHash = await hashPassword(password);

        if (commentData.passwordHash !== inputHash) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        await deleteDoc(commentRef);
        commentsCache.delete(`comment_${Number(itemId)}`);
        loadComments(itemId, true);
        logger.success('Comments', `댓글 삭제 완료: ${commentId}`);
    } catch (error) {
        console.error("Error deleting comment:", error);
        alert('댓글 삭제에 실패했습니다.');
    }
};

window.showReplyForm = showReplyForm;
window.hideReplyForm = hideReplyForm;
window.submitReply = submitReply;
window.deleteComment = deleteComment;

// 이벤트 위임 핸들러
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
            deleteComment(target.dataset.commentId, target.dataset.itemId);
            break;
    }
});

// 답글 폼 제출 이벤트 위임
document.addEventListener('submit', (e) => {
    const form = e.target.closest('.reply-form');
    if (form && form.dataset.itemId && form.dataset.parentId) {
        e.preventDefault();
        submitReply(e, form.dataset.itemId, form.dataset.parentId);
    }
});
