import { db, firebaseInitialized } from './firebase-config.js';
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, Timestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const TTL_DAYS = 90;

// 비속어 목록 로드 (여러 소스에서 병합)
let badWordsList = [];
const BADWORDS_SOURCES = [
    { url: 'https://raw.githubusercontent.com/yoonheyjung/badwords-ko/refs/heads/main/src/badwords.ko.config.json', type: 'json', key: 'badWords' },
    { url: 'https://raw.githubusercontent.com/organization/Gentleman/refs/heads/master/resources/badwords.json', type: 'json', key: 'badwords' },
    { url: './js/badwords/fword_list.txt', type: 'text' }
];

async function loadBadWords() {
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
            console.warn(`[BadWords] 소스 로드 실패: ${source.url}`, e.message);
        }
    }

    badWordsList = [...allWords];
    console.log(`[BadWords] ${badWordsList.length}개 비속어 로드 완료`);
}

function containsBadWord(text) {
    if (!text || badWordsList.length === 0) return false;
    const lowerText = text.toLowerCase();
    return badWordsList.some(word => lowerText.includes(word));
}

// 페이지 로드 시 비속어 목록 로드
loadBadWords();

function getExpireAt() {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + TTL_DAYS);
    return Timestamp.fromDate(expireDate);
}

let cleanupRan = false;
async function cleanupOldComments() {
    if (cleanupRan) return;
    cleanupRan = true;

    try {
        await firebaseInitialized;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - TTL_DAYS);

        const q = query(
            collection(db, "comments"),
            where("createdAt", "<", Timestamp.fromDate(cutoffDate)),
            limit(20)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        console.log(`[Cleanup] ${snapshot.size}개의 오래된 댓글 삭제 중...`);

        const deletePromises = [];
        snapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, "comments", docSnap.id)));
        });

        await Promise.all(deletePromises);
        console.log(`[Cleanup] ${snapshot.size}개의 오래된 댓글 삭제 완료`);
    } catch (error) {
        console.warn("[Cleanup] 오래된 댓글 삭제 실패:", error.message);
    }
}

setTimeout(() => cleanupOldComments(), 5000);

export async function loadComments(itemId) {
    await firebaseInitialized;
    const container = document.getElementById(`comments-list-${itemId}`);
    if (!container) return;

    container.innerHTML = '<div class="loading-comments">이정표 불러오는 중...</div>';

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - TTL_DAYS);

        const q = query(
            collection(db, "comments"),
            where("itemId", "==", itemId),
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

        function hasBlockedLink(text) {
            // 스티커 형식은 제외: [sticker:URL]
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
        const deletePromises = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const text = data.text || '';

            // 차단된 링크 또는 비속어 포함 시 삭제
            if (hasBlockedLink(text)) {
                console.log(`[Spam] 차단된 링크 포함 댓글 삭제: ${docSnap.id}`);
                deletePromises.push(deleteDoc(doc(db, "comments", docSnap.id)));
                return;
            }
            if (containsBadWord(text)) {
                console.log(`[BadWord] 비속어 포함 댓글 삭제: ${docSnap.id}`);
                deletePromises.push(deleteDoc(doc(db, "comments", docSnap.id)));
                return;
            }

            const date = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : '방금 전';
            const nickname = data.nickname || '익명';
            html += `
                <div class="comment-item">
                    <div class="comment-header">
                        <span class="comment-author">${nickname} <span style="font-size:0.8em; color:#888; font-weight:normal;">(${data.ip || '...'})</span></span>
                        <span class="comment-date">${date}</span>
                    </div>
                    <div class="comment-text">${processCommentText(data.text)}</div>
                </div>
            `;
        });

        if (deletePromises.length > 0) {
            Promise.all(deletePromises).catch(e => console.warn("[Spam] 삭제 실패:", e.message));
        }

        container.innerHTML = html || '<div class="no-comments">첫 번째 이정표를 남겨보세요!</div>';

    } catch (error) {
        console.error("Error loading comments:", error);
        container.innerHTML = '<div class="error-comments">이정표를 불러올 수 없습니다.</div>';
    }
}

export async function submitAnonymousComment(event, itemId) {
    event.preventDefault();
    await firebaseInitialized;
    const form = event.target;
    const input = form.querySelector('.comment-input');
    const nicknameInput = form.querySelector('.comment-nickname');
    const text = input.value.trim();
    const nickname = nicknameInput ? nicknameInput.value.trim() : '익명';

    if (!text) return;

    // 비속어 검사
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

        await addDoc(collection(db, "comments"), {
            itemId: itemId,
            text: text,
            nickname: nickname || '익명',
            ip: maskedIp,
            createdAt: serverTimestamp(),
            expireAt: getExpireAt(),
            isAnonymous: true
        });

        input.value = '';
        loadComments(itemId);
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

function toggleStickerModal(itemId) {
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

async function selectSticker(itemId, url) {
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
        await firebaseInitialized;
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
            itemId: itemId,
            text: `[sticker:${url}]`,
            nickname: nickname || '익명',
            ip: maskedIp,
            createdAt: serverTimestamp(),
            expireAt: getExpireAt(),
            isAnonymous: true
        });

        loadComments(itemId);
    } catch (error) {
        console.error("Error sending sticker:", error);
        alert('스티커 전송에 실패했습니다.');
        loadComments(itemId);
    }
}

function processCommentText(text) {
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

window.submitAnonymousComment = submitAnonymousComment;
window.loadComments = loadComments;
window.toggleStickerModal = toggleStickerModal;
window.selectSticker = selectSticker;
