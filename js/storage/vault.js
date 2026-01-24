import { db } from "./db.js";
import { getCurrentSnapshotKeys } from "./schema.js";
import { showSyncTooltip } from "../sync/ui.js";

/**
 * Saves the current localStorage state to the Vault (IndexedDB).
 * @param {string} reason - The reason for this backup.
 * @returns {Promise<{success: boolean, id?: number, error?: string}>}
 */
export const saveToVault = async (reason = "auto") => {
    try {
        const keys = getCurrentSnapshotKeys();
        const data = {};
        let hasData = false;

        for (const key of keys) {
            const value = localStorage.getItem(key);
            if (value !== null) {
                data[key] = value;
                hasData = true;
            }
        }

        if (!hasData) {
            return { success: false, error: "No data to save" };
        }

        const id = await db.add(data, reason);

        // Keep only last 50 backups to save space
        db.prune(50).catch(console.warn);

        console.log(`[Vault] Saved backup #${id} (${reason})`);

        if (reason === "manual") {
            showSyncTooltip("로컬 백업 저장 완료!", "success");
        }

        return { success: true, id };
    } catch (e) {
        console.error("[Vault] Save failed:", e);
        return { success: false, error: e.message };
    }
};

/**
 * Restores state from a specific Vault backup ID.
 * @param {number} id - The backup ID to restore.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const restoreFromVault = async (id) => {
    try {
        const entry = await db.get(id);
        if (!entry || !entry.data) {
            return { success: false, error: "Backup not found" };
        }

        const data = entry.data;
        for (const [key, value] of Object.entries(data)) {
            localStorage.setItem(key, value);
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
            console.warn("[Vault] State update after restore failed:", e);
        }

        console.log(`[Vault] Restored backup #${id}`);
        showSyncTooltip("백업 복원 완료!", "success");
        return { success: true };
    } catch (e) {
        console.error("[Vault] Restore failed:", e);
        return { success: false, error: e.message };
    }
};

/**
 * Automatically restores the latest backup if localStorage is empty/corrupt.
 * @returns {Promise<{success: boolean, restored?: boolean, reason?: string, error?: string}>}
 */
export const autoRestoreIfEmpty = async () => {
    try {
        // Check if we have essential data
        const hasCompleted = localStorage.getItem("wwm_completed");
        const hasFavorites = localStorage.getItem("wwm_favorites");

        // If we have data, we assume it's fine (or at least not empty)
        if (hasCompleted || hasFavorites) {
            return { success: true, restored: false };
        }

        console.warn("[Vault] LocalStorage appears empty. Attempting auto-restore...");

        const latest = await db.getLatest();
        if (!latest) {
            console.log("[Vault] No backups found.");
            return { success: false, reason: "no_backups" };
        }

        await restoreFromVault(latest.id);
        return { success: true, restored: true, reason: "restored_from_latest" };
    } catch (e) {
        console.error("[Vault] Auto-restore failed:", e);
        return { success: false, error: e.message };
    }
};

/**
 * Gets the history of backups.
 * @returns {Promise<Array<{id: number, timestamp: number, reason: string, size: number}>>}
 */
export const getVaultHistory = () => {
    return db.getHistory();
};
