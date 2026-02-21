import { db } from "./db.js";
import { getCurrentSnapshotKeys } from "./schema.js";
import { showSyncTooltip } from "../sync/ui.js";
import { createLogger } from "../utils/logStyles.js";

const log = createLogger("Vault");

/**
 * 현재 localStorage 상태를 Vault(IndexedDB)에 저장합니다.
 * @param {string} reason - 백업 이유.
 * @returns {Promise<{success: boolean, id?: number, error?: string}>}
 */
export const saveToVault = async (reason = "auto") => {
    try {
        const { primaryDb } = await import("./db.js");
        const exportData = await primaryDb.exportAll();
        const data = exportData.data;

        const hasData = Object.keys(data).length > 0;

        if (!hasData) {
            return { success: false, error: "저장할 데이터가 없습니다." };
        }

        const id = await db.add(data, reason);

        // 공간 절약을 위해 최근 50개의 백업만 유지
        db.prune(50).catch(console.warn);

        log.success(`Saved backup #${id}`, reason);

        if (reason === "manual") {
            showSyncTooltip("로컬 백업 저장 완료!", "success");
        }

        return { success: true, id };
    } catch (e) {
        log.error("Save failed", e);
        return { success: false, error: e.message };
    }
};

/**
 * 특정 Vault 백업 ID에서 상태를 복원합니다.
 * @param {number} id - 복원할 백업 ID.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const restoreFromVault = async (id) => {
    try {
        const entry = await db.get(id);
        if (!entry || !entry.data) {
            return { success: false, error: "백업을 찾을 수 없습니다." };
        }

        const data = entry.data;
        const { primaryDb } = await import("./db.js");
        const importResult = await primaryDb.importAll(data, true);
        if (!importResult || !importResult.success) {
            throw new Error("가져오기 실패: " + (importResult?.error || "알 수 없는 오류"));
        }

        // Update global state if possible
        try {
            const { getLocalData } = await import("../sync/storage.js");
            const { setState } = await import("../state.js");
            const restoredData = getLocalData();
            setState("completedList", restoredData.completedMarkers);
            setState("favorites", restoredData.favorites);
            // Settings are complex, but basic ones can be updated
            if (restoredData.settings) {
                Object.entries(restoredData.settings).forEach(([k, v]) => {
                    if (k !== "_updatedAt") setState(k, v);
                });
            }
        } catch (e) {
            log.warn("State update after restore failed", e);
        }

        log.success(`Restored backup #${id}`);
        showSyncTooltip("백업 복원 완료!", "success");
        return { success: true };
    } catch (e) {
        log.error("Restore failed", e);
        return { success: false, error: e.message };
    }
};

/**
 * localStorage가 비어 있거나 손상된 경우 자동으로 최신 백업을 복원합니다.
 * @returns {Promise<{success: boolean, restored?: boolean, reason?: string, error?: string, source?: string}>}
 */
export const autoRestoreIfEmpty = async () => {
    try {
        // SAFETY FIX: Check if we have ACTUAL data in primaryDb
        const { primaryDb } = await import("./db.js");
        const hasData = await primaryDb.hasData();

        // If primaryDb has real data, no restore needed
        if (hasData) {
            return { success: true, restored: false, source: "primaryDb" };
        }

        log.warn("PrimaryDb appears empty, checking backups...");

        // Fallback: Try backup snapshots
        const latest = await db.getLatest();
        if (!latest) {
            log.info("No backups found");
            return { success: false, reason: "no_backups" };
        }

        const restoreResult = await restoreFromVault(latest.id);
        if (restoreResult.success) {
            return { success: true, restored: true, reason: "restored_from_backup", source: "backup" };
        } else {
            return { success: false, reason: "restore_failed", error: restoreResult.error };
        }


    } catch (e) {
        log.error("Auto-restore failed", e);
        return { success: false, error: e.message };
    }
};

/**
 * 백업 히스토리를 가져옵니다.
 * @returns {Promise<Array<{id: number, timestamp: number, reason: string, size: number}>>}
 */
export const getVaultHistory = () => {
    return db.getHistory();
};
