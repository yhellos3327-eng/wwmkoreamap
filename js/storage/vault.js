import { db } from "./db.js";
import { getCurrentSnapshotKeys } from "./schema.js";
import { showSyncTooltip } from "../sync/ui.js";
import { createLogger } from "../utils/logStyles.js";

const log = createLogger("Vault");

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
 * Checks if a localStorage value represents actual data (not empty).
 * SAFETY FIX: Properly detects empty arrays "[]" as having no data.
 * @param {string|null} value - The localStorage value.
 * @returns {boolean} Whether the value has actual data.
 */
const hasActualData = (value) => {
    if (!value) return false;
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.length > 0;
        }
        if (typeof parsed === "object" && parsed !== null) {
            return Object.keys(parsed).length > 0;
        }
        return true;
    } catch {
        // If not valid JSON, consider it as having data (raw string)
        return value.length > 0;
    }
};

/**
 * Automatically restores the latest backup if localStorage is empty/corrupt.
 * SAFETY FIX: Properly detects empty arrays and checks Vault first.
 * @returns {Promise<{success: boolean, restored?: boolean, reason?: string, error?: string, source?: string}>}
 */
export const autoRestoreIfEmpty = async () => {
    try {
        // SAFETY FIX: Check if we have ACTUAL data (not just "[]")
        const completedRaw = localStorage.getItem("wwm_completed");
        const favoritesRaw = localStorage.getItem("wwm_favorites");

        const hasCompletedData = hasActualData(completedRaw);
        const hasFavoritesData = hasActualData(favoritesRaw);

        // If localStorage has real data, no restore needed
        if (hasCompletedData || hasFavoritesData) {
            return { success: true, restored: false, source: "localStorage" };
        }

        log.warn("LocalStorage appears empty or contains only empty arrays");

        // SAFETY FIX: Try primaryDb first (main database)
        try {
            const { primaryDb } = await import("./db.js");
            const vaultCompleted = await primaryDb.get("completedList");
            const vaultFavorites = await primaryDb.get("favorites");

            const hasVaultCompleted = Array.isArray(vaultCompleted) && vaultCompleted.length > 0;
            const hasVaultFavorites = Array.isArray(vaultFavorites) && vaultFavorites.length > 0;

            if (hasVaultCompleted || hasVaultFavorites) {
                log.info("Found data in primary database, restoring to localStorage...");

                // Restore to localStorage
                if (vaultCompleted) {
                    localStorage.setItem("wwm_completed", JSON.stringify(vaultCompleted));
                }
                if (vaultFavorites) {
                    localStorage.setItem("wwm_favorites", JSON.stringify(vaultFavorites));
                }

                // Update state
                try {
                    const { setState } = await import("../state.js");
                    if (vaultCompleted) setState("completedList", vaultCompleted);
                    if (vaultFavorites) setState("favorites", vaultFavorites);
                } catch (e) {
                    log.warn("State update failed", e);
                }

                return {
                    success: true,
                    restored: true,
                    reason: "restored_from_primary_db",
                    source: "primaryDb"
                };
            }
        } catch (e) {
            log.warn("PrimaryDb check failed", e);
        }

        // Fallback: Try backup snapshots
        const latest = await db.getLatest();
        if (!latest) {
            log.info("No backups found");
            return { success: false, reason: "no_backups" };
        }

        await restoreFromVault(latest.id);
        return { success: true, restored: true, reason: "restored_from_backup", source: "backup" };
    } catch (e) {
        log.error("Auto-restore failed", e);
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
