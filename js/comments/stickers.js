import { db, firebaseInitialized } from '../firebase-config.js';
import { collection, addDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { fetchUserIp } from '../utils.js';
import { invalidateCache } from './cache.js';
import { loadComments } from './loader.js';

const TTL_DAYS = 90;

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

const getExpireAt = () => {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + TTL_DAYS);
    return Timestamp.fromDate(expireDate);
};

export const toggleStickerModal = (itemId) => {
    const modal = document.getElementById(`sticker-modal-${itemId}`);
    const grid = document.getElementById(`sticker-grid-${itemId}`);

    if (!modal || !grid) return;

    // 팝업 컨테이너에서 popup-actions 찾기
    const popupContainer = modal.closest('.popup-container');
    const popupActions = popupContainer?.querySelector('.popup-actions');

    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        // 스티커 모달 닫힐 때 popup-actions z-index 복원
        popupActions?.classList.remove('sticker-open');
    } else {
        // 다른 모달 닫기
        document.querySelectorAll('.sticker-modal.active').forEach(m => {
            m.classList.remove('active');
            const container = m.closest('.popup-container');
            container?.querySelector('.popup-actions')?.classList.remove('sticker-open');
        });

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
        // 스티커 모달 열릴 때 popup-actions z-index 낮춤
        popupActions?.classList.add('sticker-open');
    }
};

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

    // popup-actions의 sticker-open 클래스 제거
    const popupContainer = modal.closest('.popup-container');
    popupContainer?.querySelector('.popup-actions')?.classList.remove('sticker-open');

    const container = document.getElementById(`comments-list-${itemId}`);
    if (container) {
        const tempMsg = document.createElement('div');
        tempMsg.className = 'loading-comments';
        tempMsg.textContent = '스티커 전송 중...';
        container.insertBefore(tempMsg, container.firstChild);
    }

    try {
        const maskedIp = await fetchUserIp(true);

        await addDoc(collection(db, "comments"), {
            itemId: Number(itemId),
            text: `[sticker:${url}]`,
            nickname: nickname || '익명',
            ip: maskedIp,
            createdAt: serverTimestamp(),
            expireAt: getExpireAt(),
            isAnonymous: true
        });

        invalidateCache(Number(itemId));
        loadComments(itemId, true);
    } catch (error) {
        console.error("Error sending sticker:", error);
        alert('스티커 전송에 실패했습니다.');
        loadComments(itemId, true);
    }
};

export const getStickers = () => STICKERS;
