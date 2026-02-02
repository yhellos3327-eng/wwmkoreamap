// @ts-check
/// <reference path="../types.d.ts" />
import { db, firebaseInitialized } from "../firebase-config.js";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { logger } from "../logger.js";

/** @type {number} */
const TTL_DAYS = 90;

/** @type {string} */
const CLEANUP_COOLDOWN_KEY = "wwm_cleanup_last_run";

/** @type {number} */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** @type {boolean} */
let cleanupRan = false;

/**
 * Cleans up old comments older than TTL_DAYS.
 * @returns {Promise<void>}
 */
export const cleanupOldComments = async () => {
  if (cleanupRan) return;
  cleanupRan = true;

  try {
    const { primaryDb } = await import("../storage/db.js");
    const lastRunVal = await primaryDb.get(CLEANUP_COOLDOWN_KEY);
    const lastRun = lastRunVal ? parseInt(String(lastRunVal), 10) : 0;

    if (!isNaN(lastRun) && lastRun > 0 && Date.now() - lastRun < COOLDOWN_MS) {
      logger.log("Cleanup", "쿨다운 중 - 24시간 내 이미 실행됨");
      return;
    }

    await firebaseInitialized;
    if (!db) {
      logger.warn("Cleanup", "Firebase DB 초기화 실패, 정리 건너뛰");
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TTL_DAYS);

    const q = query(
      collection(db, "comments"),
      where("createdAt", "<", Timestamp.fromDate(cutoffDate)),
      limit(10),
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      await primaryDb.set(CLEANUP_COOLDOWN_KEY, Date.now().toString());
      return;
    }

    logger.log("Cleanup", `${snapshot.size}개 오래된 댓글 삭제 중...`);

    const deletePromises = [];
    snapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, "comments", docSnap.id)));
    });

    await Promise.all(deletePromises);
    await primaryDb.set(CLEANUP_COOLDOWN_KEY, Date.now().toString());
    logger.success("Cleanup", `${snapshot.size}개 오래된 댓글 삭제 완료`);
  } catch (error) {
    // Reset cleanupRan on error to allow retries
    cleanupRan = false;
    logger.warn("Cleanup", "오래된 댓글 삭제 실패:", error.message);
  }
};

/**
 * Schedules a cleanup after a delay.
 * @param {number} [delayMs=10000] - Delay in milliseconds.
 */
export const scheduleCleanup = (delayMs = 10000) => {
  setTimeout(() => cleanupOldComments(), delayMs);
};
