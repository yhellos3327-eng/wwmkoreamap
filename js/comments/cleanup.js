import { db, firebaseInitialized } from '../firebase-config.js';
import { collection, query, where, limit, getDocs, deleteDoc, doc, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { logger } from '../logger.js';

const TTL_DAYS = 90;
const CLEANUP_COOLDOWN_KEY = 'wwm_cleanup_last_run';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

let cleanupRan = false;

export const cleanupOldComments = async () => {
    if (cleanupRan) return;
    cleanupRan = true;

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
};

export const scheduleCleanup = (delayMs = 10000) => {
    setTimeout(() => cleanupOldComments(), delayMs);
};
