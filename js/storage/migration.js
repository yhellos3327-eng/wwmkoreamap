// @ts-check
/**
 * @fileoverview Migration module - handles safe migration from localStorage to Vault (IndexedDB).
 * Ensures no data loss during the transition.
 * @module storage/migration
 */

import { primaryDb, db } from "./db.js";
import { getCurrentSnapshotKeys } from "./schema.js";
import { createLogger } from "../utils/logStyles.js";

const log = createLogger("Migration");

const MIGRATION_VERSION_KEY = "wwm_migration_version";
// Version 2: localStorage → Vault migration (localStorage kept as backup)
// NOTE: v3 (localStorage cleanup) is deferred until state.js initialization is refactored
// Currently state.js reads from localStorage synchronously at module load,
// so deleting localStorage before that causes data loss on refresh.
const CURRENT_MIGRATION_VERSION = 3;

/**
 * List of localStorage keys to be deleted after successful migration.
 * These are the user data keys that are now stored in Vault (IndexedDB).
 */
const DEPRECATED_LOCALSTORAGE_KEYS = [
    "wwm_completed",
    "wwm_favorites",
    "wwm_favorites_qinghe",
    "wwm_favorites_kaifeng",
    "wwm_favorites_dreamsunsun"
];

/**
 * @typedef {Object} MigrationResult
 * @property {boolean} success - Whether migration succeeded.
 * @property {boolean} migrated - Whether migration was actually performed.
 * @property {string} [source] - Data source used ('vault', 'localStorage', 'none').
 * @property {number} [completedCount] - Number of completed items migrated.
 * @property {number} [favoritesCount] - Number of favorites migrated.
 * @property {string} [error] - Error message if failed.
 */

/**
 * @typedef {Object} DataSnapshot
 * @property {any[]} completedMarkers
 * @property {any[]} favorites
 * @property {Object} settings
 * @property {number} timestamp
 */

/**
 * Cleans up deprecated localStorage keys after successful migration.
 * This removes the old user data keys that are now stored in Vault.
 * @returns {string[]} List of removed keys.
 */
const cleanupDeprecatedLocalStorageKeys = () => {
    const removedKeys = [];

    for (const key of DEPRECATED_LOCALSTORAGE_KEYS) {
        try {
            if (localStorage.getItem(key) !== null) {
                localStorage.removeItem(key);
                removedKeys.push(key);
            }
        } catch (e) {
            log.warn(`Failed to remove ${key}`, e);
        }
    }

    return removedKeys;
};

/**
 * Gets the current migration version.
 * @returns {number} The current version.
 */
const getMigrationVersion = () => {
    try {
        const version = localStorage.getItem(MIGRATION_VERSION_KEY);
        return version ? parseInt(version, 10) : 0;
    } catch {
        return 0;
    }
};

/**
 * Sets the migration version.
 * @param {number} version - The version to set.
 */
const setMigrationVersion = (version) => {
    try {
        localStorage.setItem(MIGRATION_VERSION_KEY, String(version));
    } catch (e) {
        log.warn("Failed to set version", e);
    }
};

/**
 * Extracts data from localStorage in a safe way.
 * @returns {DataSnapshot} The extracted data.
 */
const extractLocalStorageData = () => {
    const result = {
        completedMarkers: [],
        favorites: [],
        settings: {},
        timestamp: Date.now()
    };

    try {
        // Extract completed markers
        const completedRaw = localStorage.getItem("wwm_completed");
        if (completedRaw) {
            const parsed = JSON.parse(completedRaw);
            if (Array.isArray(parsed)) {
                // Normalize to object format
                result.completedMarkers = parsed.map(item => {
                    if (typeof item === "object" && item !== null) {
                        return item;
                    }
                    return { id: item, completedAt: null };
                });
            }
        }
    } catch (e) {
        log.warn("Failed to parse completedMarkers", e);
    }

    try {
        // Extract favorites (try multiple keys for legacy support)
        const favKeys = [
            "wwm_favorites",
            "wwm_favorites_qinghe",
            "wwm_favorites_kaifeng",
            "wwm_favorites_dreamsunsun"
        ];

        for (const key of favKeys) {
            const favRaw = localStorage.getItem(key);
            if (favRaw) {
                const parsed = JSON.parse(favRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Merge unique favorites
                    const existingIds = new Set(result.favorites.map(f =>
                        typeof f === "object" ? f.id : f
                    ));
                    for (const fav of parsed) {
                        const id = typeof fav === "object" ? fav.id : fav;
                        if (!existingIds.has(id)) {
                            result.favorites.push(fav);
                            existingIds.add(id);
                        }
                    }
                }
            }
        }
    } catch (e) {
        log.warn("Failed to parse favorites", e);
    }

    try {
        // Extract settings
        /** @type {[string, string, (v: string) => any][]} */
        const settingKeys = [
            ["wwm_show_comments", "showComments", (v) => v !== "false"],
            ["wwm_close_on_complete", "closeOnComplete", (v) => v === "true"],
            ["wwm_hide_completed", "hideCompleted", (v) => v === "true"],
            ["wwm_enable_clustering", "enableClustering", (v) => v !== "false"],
            ["wwm_show_ad", "showAd", (v) => v !== "false"],
            ["wwm_region_color", "regionColor", (v) => v],
            ["wwm_region_fill_color", "regionFillColor", (v) => v],
            ["wwm_gpu_setting", "gpuMode", (v) => v],
            ["wwm_menu_position", "menuPosition", (v) => v],
        ];

        for (const [lsKey, settingKey, parser] of settingKeys) {
            const value = localStorage.getItem(lsKey);
            if (value !== null) {
                result.settings[settingKey] = parser(value);
            }
        }

        // Extract map-specific settings
        const mapKeys = ["qinghe", "kaifeng", "dreamsunsun"];
        for (const mapKey of mapKeys) {
            const catsKey = `wwm_active_cats_${mapKey}`;
            const regsKey = `wwm_active_regs_${mapKey}`;
            const favsKey = `wwm_favorites_${mapKey}`;

            const cats = localStorage.getItem(catsKey);
            if (cats) {
                try {
                    result.settings[`activeCats_${mapKey}`] = JSON.parse(cats);
                } catch { }
            }

            const regs = localStorage.getItem(regsKey);
            if (regs) {
                try {
                    result.settings[`activeRegs_${mapKey}`] = JSON.parse(regs);
                } catch { }
            }

            const favs = localStorage.getItem(favsKey);
            if (favs) {
                try {
                    result.settings[`favorites_${mapKey}`] = JSON.parse(favs);
                } catch { }
            }
        }

        // Extract settings timestamps
        const timestampsRaw = localStorage.getItem("wwm_settings_updated_at");
        if (timestampsRaw) {
            try {
                result.settings._updatedAt = JSON.parse(timestampsRaw);
            } catch { }
        }
    } catch (e) {
        log.warn("Failed to parse settings", e);
    }

    return result;
};

/**
 * Creates a pre-migration backup in the vault.
 * @param {DataSnapshot} data - The data to backup.
 * @returns {Promise<{success: boolean, id?: number}>}
 */
const createPreMigrationBackup = async (data) => {
    try {
        // Save to vault backup store
        const backupData = {};
        const keys = getCurrentSnapshotKeys();

        for (const key of keys) {
            const value = localStorage.getItem(key);
            if (value !== null) {
                backupData[key] = value;
            }
        }

        if (Object.keys(backupData).length > 0) {
            const id = await db.add(backupData, "pre_migration");
            log.vault(`Pre-migration backup created`, `#${id}`);
            return { success: true, id };
        }

        return { success: true };
    } catch (e) {
        log.error("Failed to create backup", e);
        return { success: false };
    }
};

/**
 * Validates that the migration was successful by comparing data.
 * @param {DataSnapshot} original - Original data from localStorage.
 * @returns {Promise<boolean>} Whether validation passed.
 */
const validateMigration = async (original) => {
    try {
        const vaultCompleted = await primaryDb.get("completedList");
        const vaultFavorites = await primaryDb.get("favorites");

        // Check completed markers count
        if (original.completedMarkers.length > 0) {
            if (!Array.isArray(vaultCompleted)) {
                log.error("Validation failed: completedList not an array");
                return false;
            }
            if (vaultCompleted.length < original.completedMarkers.length) {
                log.error("Validation failed: completedList count mismatch",
                    `${original.completedMarkers.length} vs ${vaultCompleted.length}`);
                return false;
            }
        }

        // Check favorites count
        if (original.favorites.length > 0) {
            if (!Array.isArray(vaultFavorites)) {
                log.error("Validation failed: favorites not an array");
                return false;
            }
            if (vaultFavorites.length < original.favorites.length) {
                log.error("Validation failed: favorites count mismatch",
                    `${original.favorites.length} vs ${vaultFavorites.length}`);
                return false;
            }
        }

        return true;
    } catch (e) {
        log.error("Validation error", e);
        return false;
    }
};

/**
 * Performs the migration from localStorage to Vault.
 * This is the main migration function.
 * @returns {Promise<MigrationResult>}
 */
export const migrateToVault = async () => {
    const currentVersion = getMigrationVersion();

    // Already migrated
    if (currentVersion >= CURRENT_MIGRATION_VERSION) {
        log.info(`Already at version ${currentVersion}`);
        return { success: true, migrated: false, source: "vault" };
    }

    log.migration(`Starting migration`, `v${currentVersion} → v${CURRENT_MIGRATION_VERSION}`);

    try {
        // Step 1: Check if Vault already has data
        const vaultHasData = await primaryDb.hasData();
        const vaultCompleted = vaultHasData ? await primaryDb.get("completedList") : null;
        const vaultFavorites = vaultHasData ? await primaryDb.get("favorites") : null;

        // Step 2: Extract localStorage data
        const localData = extractLocalStorageData();

        const localHasData = localData.completedMarkers.length > 0 || localData.favorites.length > 0;
        const vaultDataCount = (vaultCompleted?.length || 0) + (vaultFavorites?.length || 0);
        const localDataCount = localData.completedMarkers.length + localData.favorites.length;

        log.info(`Data check`, { vault: vaultDataCount, local: localDataCount });

        // Step 3: Decide migration strategy
        if (!localHasData && !vaultHasData) {
            // No data anywhere, just mark as migrated
            setMigrationVersion(CURRENT_MIGRATION_VERSION);
            return { success: true, migrated: false, source: "none" };
        }

        if (vaultHasData && vaultDataCount >= localDataCount) {
            // Vault already has more or equal data, use vault
            log.vault("Vault has sufficient data, skipping localStorage migration");
            setMigrationVersion(CURRENT_MIGRATION_VERSION);
            return {
                success: true,
                migrated: false,
                source: "vault",
                completedCount: vaultCompleted?.length || 0,
                favoritesCount: vaultFavorites?.length || 0
            };
        }

        // Step 4: Create pre-migration backup
        if (localHasData) {
            await createPreMigrationBackup(localData);
        }

        // Step 5: Migrate data to Vault
        // Merge with existing vault data if any
        let finalCompleted = localData.completedMarkers;
        let finalFavorites = localData.favorites;
        let finalSettings = localData.settings;

        if (vaultHasData) {
            // Merge: prefer local if newer or more complete
            if (vaultCompleted && Array.isArray(vaultCompleted)) {
                const mergedCompleted = new Map();

                // Add vault data first
                for (const item of vaultCompleted) {
                    const id = typeof item === "object" ? item.id : item;
                    mergedCompleted.set(String(id), item);
                }

                // Add/update with local data
                for (const item of localData.completedMarkers) {
                    const id = typeof item === "object" ? item.id : item;
                    const existing = mergedCompleted.get(String(id));

                    if (!existing) {
                        mergedCompleted.set(String(id), item);
                    } else if (item.completedAt && existing.completedAt) {
                        // Keep newer
                        const localTime = new Date(item.completedAt).getTime();
                        const vaultTime = new Date(existing.completedAt).getTime();
                        if (localTime > vaultTime) {
                            mergedCompleted.set(String(id), item);
                        }
                    } else if (item.completedAt) {
                        mergedCompleted.set(String(id), item);
                    }
                }

                finalCompleted = Array.from(mergedCompleted.values());
            }

            if (vaultFavorites && Array.isArray(vaultFavorites)) {
                const mergedFavorites = new Map();

                for (const item of vaultFavorites) {
                    const id = typeof item === "object" ? item.id : item;
                    mergedFavorites.set(String(id), item);
                }

                for (const item of localData.favorites) {
                    const id = typeof item === "object" ? item.id : item;
                    if (!mergedFavorites.has(String(id))) {
                        mergedFavorites.set(String(id), item);
                    }
                }

                finalFavorites = Array.from(mergedFavorites.values());
            }

            const vaultSettings = await primaryDb.get("settings");
            if (vaultSettings && typeof vaultSettings === "object") {
                finalSettings = { ...vaultSettings, ...localData.settings };
            }
        }

        // Step 6: Save to Vault
        const saveResult = await primaryDb.setMultiple([
            { key: "completedList", value: finalCompleted },
            { key: "favorites", value: finalFavorites },
            { key: "settings", value: finalSettings }
        ]);

        if (!saveResult.success) {
            log.error("Failed to save to Vault", saveResult.error);
            return { success: false, migrated: false, error: saveResult.error };
        }

        // Step 7: Validate migration
        const isValid = await validateMigration({
            completedMarkers: finalCompleted,
            favorites: finalFavorites,
            settings: finalSettings,
            timestamp: Date.now()
        });

        if (!isValid) {
            log.error("Validation failed, migration aborted");
            return { success: false, migrated: false, error: "Validation failed" };
        }

        // Step 8: Mark migration complete
        setMigrationVersion(CURRENT_MIGRATION_VERSION);

        // Step 9: Clean up localStorage (v3)
        // localStorage is no longer needed as backup since state.js is now async
        if (CURRENT_MIGRATION_VERSION >= 3) {
            const removedKeys = cleanupDeprecatedLocalStorageKeys();
            if (removedKeys.length > 0) {
                log.success("Cleaned up localStorage keys", removedKeys);
            }
        }

        log.success("Successfully migrated to Vault", {
            completed: finalCompleted.length,
            favorites: finalFavorites.length
        });

        return {
            success: true,
            migrated: true,
            source: "localStorage",
            completedCount: finalCompleted.length,
            favoritesCount: finalFavorites.length
        };

    } catch (e) {
        log.error("Migration failed", e);
        return { success: false, migrated: false, error: e.message };
    }
};

/**
 * @deprecated Since v3 - localStorage is no longer used for user data after migration.
 * Syncs current state back to localStorage for backward compatibility.
 * This should be called after saving to Vault.
 * Only used for non-migrated users.
 * @param {any[]} completedList - The completed list.
 * @param {any[]} favorites - The favorites list.
 */
export const syncToLocalStorage = (completedList, favorites) => {
    // Skip for migrated users - Vault is the single source of truth
    if (isMigrated()) {
        log.info("syncToLocalStorage skipped - user is migrated");
        return;
    }

    try {
        if (Array.isArray(completedList)) {
            localStorage.setItem("wwm_completed", JSON.stringify(completedList));
        }
        if (Array.isArray(favorites)) {
            localStorage.setItem("wwm_favorites", JSON.stringify(favorites));
        }
    } catch (e) {
        log.warn("Failed to sync to localStorage", e);
    }
};

/**
 * Loads data from Vault (IndexedDB) as the single source of truth.
 * For migrated users: Vault ONLY (localStorage is deleted).
 * For non-migrated users: Compare both sources and use the one with more data.
 * @returns {Promise<{completedList: any[], favorites: any[], settings: Object, source: string}>}
 */
export const loadDataWithFallback = async () => {
    try {
        // For migrated users (v3+), Vault is the ONLY source
        if (isMigrated()) {
            log.vault("User is migrated - using Vault only");
            const vaultCompleted = await primaryDb.get("completedList");
            const vaultFavorites = await primaryDb.get("favorites");
            const vaultSettings = await primaryDb.get("settings");

            return {
                completedList: vaultCompleted || [],
                favorites: vaultFavorites || [],
                settings: vaultSettings || {},
                source: "vault_primary"
            };
        }

        // For non-migrated users, compare both sources
        const vaultCompleted = await primaryDb.get("completedList");
        const vaultFavorites = await primaryDb.get("favorites");
        const vaultSettings = await primaryDb.get("settings");

        const localData = extractLocalStorageData();

        // Calculate counts
        const vaultCompletedCount = Array.isArray(vaultCompleted) ? vaultCompleted.length : 0;
        const vaultFavoritesCount = Array.isArray(vaultFavorites) ? vaultFavorites.length : 0;
        const vaultTotal = vaultCompletedCount + vaultFavoritesCount;

        const localCompletedCount = localData.completedMarkers.length;
        const localFavoritesCount = localData.favorites.length;
        const localTotal = localCompletedCount + localFavoritesCount;

        log.info(`Data comparison`, { vault: `${vaultTotal} (${vaultCompletedCount}+${vaultFavoritesCount})`, local: `${localTotal} (${localCompletedCount}+${localFavoritesCount})` });

        // SAFETY: Choose the source with MORE data
        // This prevents data loss when user accessed with old cached JS version
        if (vaultTotal >= localTotal && vaultTotal > 0) {
            log.vault("Using Vault (has more or equal data)");
            return {
                completedList: vaultCompleted || [],
                favorites: vaultFavorites || [],
                settings: vaultSettings || {},
                source: "vault"
            };
        }

        if (localTotal > vaultTotal) {
            log.localStorage("Using localStorage (has more data - will migrate to Vault)");

            // Sync localStorage data to Vault for next time
            try {
                await primaryDb.setMultiple([
                    { key: "completedList", value: localData.completedMarkers },
                    { key: "favorites", value: localData.favorites },
                    { key: "settings", value: localData.settings }
                ]);
                log.success("Synced localStorage → Vault");
            } catch (e) {
                log.warn("Failed to sync to Vault", e);
            }

            return {
                completedList: localData.completedMarkers,
                favorites: localData.favorites,
                settings: localData.settings,
                source: "localStorage"
            };
        }

        // No data found in either
        return {
            completedList: [],
            favorites: [],
            settings: {},
            source: "none"
        };

    } catch (e) {
        log.error("loadDataWithFallback failed", e);

        // Emergency fallback to localStorage (only for non-migrated users)
        if (!isMigrated()) {
            try {
                const localData = extractLocalStorageData();
                return {
                    completedList: localData.completedMarkers,
                    favorites: localData.favorites,
                    settings: localData.settings,
                    source: "localStorage_emergency"
                };
            } catch (e2) {
                // Fall through to error return
            }
        }

        return {
            completedList: [],
            favorites: [],
            settings: {},
            source: "error"
        };
    }
};

/**
 * Checks if migration is needed.
 * @returns {boolean} Whether migration is needed.
 */
export const needsMigration = () => {
    return getMigrationVersion() < CURRENT_MIGRATION_VERSION;
};

/**
 * Checks if migration is already done.
 * @returns {boolean} Whether migration is done.
 */
export const isMigrated = () => {
    return getMigrationVersion() >= CURRENT_MIGRATION_VERSION;
};

/**
 * Gets migration status info.
 * @returns {Promise<{version: number, vaultHasData: boolean, localHasData: boolean}>}
 */
export const getMigrationStatus = async () => {
    const version = getMigrationVersion();
    const vaultHasData = await primaryDb.hasData();

    const localData = extractLocalStorageData();
    const localHasData = localData.completedMarkers.length > 0 || localData.favorites.length > 0;

    return { version, vaultHasData, localHasData };
};
