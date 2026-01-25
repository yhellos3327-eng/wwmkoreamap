// @ts-check
/**
 * @fileoverview Migration module - handles safe migration from localStorage to Vault (IndexedDB).
 * Ensures no data loss during the transition.
 * @module storage/migration
 */

import { primaryDb, db } from "./db.js";
import { getCurrentSnapshotKeys } from "./schema.js";

const MIGRATION_VERSION_KEY = "wwm_migration_version";
const CURRENT_MIGRATION_VERSION = 2;

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
        console.warn("[Migration] Failed to set version:", e);
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
        console.warn("[Migration] Failed to parse completedMarkers:", e);
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
        console.warn("[Migration] Failed to parse favorites:", e);
    }

    try {
        // Extract settings
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
        console.warn("[Migration] Failed to parse settings:", e);
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
            console.log(`[Migration] Pre-migration backup created: #${id}`);
            return { success: true, id };
        }

        return { success: true };
    } catch (e) {
        console.error("[Migration] Failed to create backup:", e);
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
                console.error("[Migration] Validation failed: completedList not an array");
                return false;
            }
            if (vaultCompleted.length < original.completedMarkers.length) {
                console.error("[Migration] Validation failed: completedList count mismatch",
                    original.completedMarkers.length, "vs", vaultCompleted.length);
                return false;
            }
        }

        // Check favorites count
        if (original.favorites.length > 0) {
            if (!Array.isArray(vaultFavorites)) {
                console.error("[Migration] Validation failed: favorites not an array");
                return false;
            }
            if (vaultFavorites.length < original.favorites.length) {
                console.error("[Migration] Validation failed: favorites count mismatch",
                    original.favorites.length, "vs", vaultFavorites.length);
                return false;
            }
        }

        return true;
    } catch (e) {
        console.error("[Migration] Validation error:", e);
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
        console.log("[Migration] Already at version", currentVersion);
        return { success: true, migrated: false, source: "vault" };
    }

    console.log("[Migration] Starting migration from version", currentVersion, "to", CURRENT_MIGRATION_VERSION);

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

        console.log("[Migration] Data check - Vault:", vaultDataCount, "Local:", localDataCount);

        // Step 3: Decide migration strategy
        if (!localHasData && !vaultHasData) {
            // No data anywhere, just mark as migrated
            setMigrationVersion(CURRENT_MIGRATION_VERSION);
            return { success: true, migrated: false, source: "none" };
        }

        if (vaultHasData && vaultDataCount >= localDataCount) {
            // Vault already has more or equal data, use vault
            console.log("[Migration] Vault has sufficient data, skipping localStorage migration");
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
            console.error("[Migration] Failed to save to Vault:", saveResult.error);
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
            console.error("[Migration] Validation failed, migration aborted");
            return { success: false, migrated: false, error: "Validation failed" };
        }

        // Step 8: Mark migration complete
        setMigrationVersion(CURRENT_MIGRATION_VERSION);

        console.log("[Migration] Successfully migrated to Vault");
        console.log(`  - Completed: ${finalCompleted.length}`);
        console.log(`  - Favorites: ${finalFavorites.length}`);

        return {
            success: true,
            migrated: true,
            source: "localStorage",
            completedCount: finalCompleted.length,
            favoritesCount: finalFavorites.length
        };

    } catch (e) {
        console.error("[Migration] Migration failed:", e);
        return { success: false, migrated: false, error: e.message };
    }
};

/**
 * Syncs current state back to localStorage for backward compatibility.
 * This should be called after saving to Vault.
 * @param {any[]} completedList - The completed list.
 * @param {any[]} favorites - The favorites list.
 */
export const syncToLocalStorage = (completedList, favorites) => {
    try {
        if (Array.isArray(completedList)) {
            localStorage.setItem("wwm_completed", JSON.stringify(completedList));
        }
        if (Array.isArray(favorites)) {
            localStorage.setItem("wwm_favorites", JSON.stringify(favorites));
        }
    } catch (e) {
        console.warn("[Migration] Failed to sync to localStorage:", e);
    }
};

/**
 * Loads data with smart comparison between Vault and localStorage.
 * SAFETY: Returns the source with MORE data to prevent data loss from version mismatch.
 * @returns {Promise<{completedList: any[], favorites: any[], settings: Object, source: string}>}
 */
export const loadDataWithFallback = async () => {
    try {
        // Get data from both sources
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

        console.log(`[Migration] Data comparison - Vault: ${vaultTotal} (${vaultCompletedCount}+${vaultFavoritesCount}), Local: ${localTotal} (${localCompletedCount}+${localFavoritesCount})`);

        // SAFETY: Choose the source with MORE data
        // This prevents data loss when user accessed with old cached JS version
        if (vaultTotal >= localTotal && vaultTotal > 0) {
            console.log("[Migration] Using Vault (has more or equal data)");
            return {
                completedList: vaultCompleted || [],
                favorites: vaultFavorites || [],
                settings: vaultSettings || {},
                source: "vault"
            };
        }

        if (localTotal > vaultTotal) {
            console.log("[Migration] Using localStorage (has more data - possible old version access)");

            // Sync localStorage data to Vault for next time
            try {
                await primaryDb.setMultiple([
                    { key: "completedList", value: localData.completedMarkers },
                    { key: "favorites", value: localData.favorites },
                    { key: "settings", value: localData.settings }
                ]);
                console.log("[Migration] Synced localStorage → Vault");
            } catch (e) {
                console.warn("[Migration] Failed to sync to Vault:", e);
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
        console.error("[Migration] loadDataWithFallback failed:", e);

        // Emergency fallback to localStorage
        try {
            const localData = extractLocalStorageData();
            return {
                completedList: localData.completedMarkers,
                favorites: localData.favorites,
                settings: localData.settings,
                source: "localStorage_emergency"
            };
        } catch (e2) {
            return {
                completedList: [],
                favorites: [],
                settings: {},
                source: "error"
            };
        }
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
