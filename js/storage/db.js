// @ts-check
/**
 * @fileoverview Dexie.js wrapper for persistent storage vault.
 * Primary database for user data (completedList, favorites, settings).
 * @module storage/db
 */

// @ts-ignore
import { Dexie } from 'https://unpkg.com/dexie/dist/modern/dexie.mjs';

const DB_NAME = "WwmVaultDB";
const STORE_NAME = "backups";
const PRIMARY_STORE = "primary_data";

// Initialize Dexie database
const dexieDb = new Dexie(DB_NAME);

// Define schema - version 2 adds primary_data store
dexieDb.version(1).stores({
    [STORE_NAME]: '++id, timestamp, reason'
});

dexieDb.version(2).stores({
    [STORE_NAME]: '++id, timestamp, reason',
    [PRIMARY_STORE]: 'key, updatedAt'
});

export const db = {
    /**
     * Adds a backup entry.
     * @param {Object} data - The data to backup.
     * @param {string} reason - The reason for backup (e.g., 'auto', 'manual', 'init').
     * @returns {Promise<number>} The new backup ID.
     */
    add: async (data, reason = "auto") => {
        try {
            // @ts-ignore
            const id = await dexieDb[STORE_NAME].add({
                timestamp: Date.now(),
                date: new Date().toISOString(),
                reason,
                data,
            });
            return id;
        } catch (error) {
            console.error("[Dexie] Add failed:", error);
            throw error;
        }
    },

    /**
     * Gets the latest backup.
     * @returns {Promise<Object|null>} The latest backup entry.
     */
    getLatest: async () => {
        try {
            // @ts-ignore
            const latest = await dexieDb[STORE_NAME]
                .orderBy('timestamp')
                .reverse()
                .first();
            return latest || null;
        } catch (error) {
            console.error("[Dexie] GetLatest failed:", error);
            return null;
        }
    },

    /**
     * Gets all backup headers (without data) for listing.
     * @param {number} [limit=20] - Max items to return.
     * @returns {Promise<Array<{id: number, timestamp: number, reason: string, size: number}>>}
     */
    getHistory: async (limit = 20) => {
        try {
            // @ts-ignore
            const backups = await dexieDb[STORE_NAME]
                .orderBy('timestamp')
                .reverse()
                .limit(limit)
                .toArray();

            return backups.map(b => ({
                id: b.id,
                timestamp: b.timestamp,
                reason: b.reason,
                size: JSON.stringify(b.data).length,
            }));
        } catch (error) {
            console.error("[Dexie] GetHistory failed:", error);
            return [];
        }
    },

    /**
     * Gets a specific backup by ID.
     * @param {number} id - The backup ID.
     * @returns {Promise<Object|null>} The backup entry.
     */
    get: async (id) => {
        try {
            // @ts-ignore
            const entry = await dexieDb[STORE_NAME].get(id);
            return entry || null;
        } catch (error) {
            console.error("[Dexie] Get failed:", error);
            return null;
        }
    },

    /**
     * Deletes old backups, keeping only the latest N.
     * @param {number} [keep=50] - Number of backups to keep.
     */
    prune: async (keep = 50) => {
        try {
            // @ts-ignore
            const allIds = await dexieDb[STORE_NAME]
                .orderBy('timestamp')
                .reverse()
                .offset(keep)
                .primaryKeys();

            if (allIds.length > 0) {
                // @ts-ignore
                await dexieDb[STORE_NAME].bulkDelete(allIds);
                console.log(`[Dexie] Pruned ${allIds.length} old backups.`);
            }
        } catch (error) {
            console.error("[Dexie] Prune failed:", error);
        }
    },
};

// ============================================================================
// PRIMARY DATA STORE - Main database for user data
// ============================================================================

/**
 * @typedef {Object} PrimaryDataEntry
 * @property {string} key - The data key (e.g., 'completedList', 'favorites', 'settings')
 * @property {any} value - The actual data
 * @property {number} updatedAt - Timestamp of last update
 * @property {number} [version] - Data version for conflict resolution
 */

/**
 * Primary data store for main user data.
 * This replaces localStorage as the source of truth.
 */
export const primaryDb = {
    /**
     * Gets a value from the primary store.
     * @param {string} key - The data key.
     * @returns {Promise<any|null>} The stored value or null.
     */
    get: async (key) => {
        try {
            // @ts-ignore
            const entry = await dexieDb[PRIMARY_STORE].get(key);
            console.log(`[PrimaryDB] get("${key}"):`, entry ? `found (${Array.isArray(entry.value) ? entry.value.length + ' items' : typeof entry.value})` : 'null');
            return entry?.value ?? null;
        } catch (error) {
            console.error("[PrimaryDB] Get failed:", key, error);
            return null;
        }
    },

    /**
     * Gets a value with metadata.
     * @param {string} key - The data key.
     * @returns {Promise<PrimaryDataEntry|null>} The entry with metadata or null.
     */
    getWithMeta: async (key) => {
        try {
            // @ts-ignore
            const entry = await dexieDb[PRIMARY_STORE].get(key);
            return entry || null;
        } catch (error) {
            console.error("[PrimaryDB] GetWithMeta failed:", key, error);
            return null;
        }
    },

    /**
     * Sets a value in the primary store.
     * @param {string} key - The data key.
     * @param {any} value - The value to store.
     * @param {number} [version] - Optional version number.
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    set: async (key, value, version) => {
        try {
            const now = Date.now();
            // @ts-ignore
            await dexieDb[PRIMARY_STORE].put({
                key,
                value,
                updatedAt: now,
                version: version ?? now
            });
            console.log(`[PrimaryDB] set("${key}"):`, Array.isArray(value) ? `${value.length} items` : typeof value);
            return { success: true };
        } catch (error) {
            console.error("[PrimaryDB] Set failed:", key, error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sets multiple values atomically.
     * @param {Array<{key: string, value: any, version?: number}>} entries - Entries to set.
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    setMultiple: async (entries) => {
        try {
            const now = Date.now();
            const records = entries.map(({ key, value, version }) => ({
                key,
                value,
                updatedAt: now,
                version: version ?? now
            }));
            // @ts-ignore
            await dexieDb[PRIMARY_STORE].bulkPut(records);
            console.log(`[PrimaryDB] setMultiple:`, entries.map(e => `${e.key}=${Array.isArray(e.value) ? e.value.length + ' items' : typeof e.value}`).join(', '));
            return { success: true };
        } catch (error) {
            console.error("[PrimaryDB] SetMultiple failed:", error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Gets all entries from the primary store.
     * @returns {Promise<Object<string, any>>} All stored data as key-value pairs.
     */
    getAll: async () => {
        try {
            // @ts-ignore
            const entries = await dexieDb[PRIMARY_STORE].toArray();
            const result = {};
            for (const entry of entries) {
                result[entry.key] = entry.value;
            }
            return result;
        } catch (error) {
            console.error("[PrimaryDB] GetAll failed:", error);
            return {};
        }
    },

    /**
     * Gets all entries with metadata.
     * @returns {Promise<PrimaryDataEntry[]>} All entries with metadata.
     */
    getAllWithMeta: async () => {
        try {
            // @ts-ignore
            return await dexieDb[PRIMARY_STORE].toArray();
        } catch (error) {
            console.error("[PrimaryDB] GetAllWithMeta failed:", error);
            return [];
        }
    },

    /**
     * Deletes a value from the primary store.
     * @param {string} key - The data key.
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    delete: async (key) => {
        try {
            // @ts-ignore
            await dexieDb[PRIMARY_STORE].delete(key);
            return { success: true };
        } catch (error) {
            console.error("[PrimaryDB] Delete failed:", key, error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Checks if the primary store has any data.
     * @returns {Promise<boolean>} Whether data exists.
     */
    hasData: async () => {
        try {
            // @ts-ignore
            const count = await dexieDb[PRIMARY_STORE].count();
            return count > 0;
        } catch (error) {
            console.error("[PrimaryDB] HasData failed:", error);
            return false;
        }
    },

    /**
     * Gets the count of entries.
     * @returns {Promise<number>} Entry count.
     */
    count: async () => {
        try {
            // @ts-ignore
            return await dexieDb[PRIMARY_STORE].count();
        } catch (error) {
            console.error("[PrimaryDB] Count failed:", error);
            return 0;
        }
    },

    /**
     * Clears all data from the primary store (use with caution!).
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    clear: async () => {
        try {
            // @ts-ignore
            await dexieDb[PRIMARY_STORE].clear();
            return { success: true };
        } catch (error) {
            console.error("[PrimaryDB] Clear failed:", error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Exports all data for backup purposes.
     * @returns {Promise<{data: Object, exportedAt: number, version: string}>}
     */
    exportAll: async () => {
        try {
            // @ts-ignore
            const entries = await dexieDb[PRIMARY_STORE].toArray();
            const data = {};
            for (const entry of entries) {
                data[entry.key] = {
                    value: entry.value,
                    updatedAt: entry.updatedAt,
                    version: entry.version
                };
            }
            return {
                data,
                exportedAt: Date.now(),
                version: "2.0"
            };
        } catch (error) {
            console.error("[PrimaryDB] ExportAll failed:", error);
            return { data: {}, exportedAt: Date.now(), version: "2.0" };
        }
    },

    /**
     * Imports data from a backup (with safety checks).
     * @param {Object<string, {value: any, updatedAt?: number, version?: number}>} data - Data to import.
     * @param {boolean} [overwrite=false] - Whether to overwrite existing data.
     * @returns {Promise<{success: boolean, imported: number, skipped: number, error?: string}>}
     */
    importAll: async (data, overwrite = false) => {
        try {
            let imported = 0;
            let skipped = 0;
            const now = Date.now();

            for (const [key, entry] of Object.entries(data)) {
                if (!overwrite) {
                    // @ts-ignore
                    const existing = await dexieDb[PRIMARY_STORE].get(key);
                    if (existing) {
                        skipped++;
                        continue;
                    }
                }

                // @ts-ignore
                await dexieDb[PRIMARY_STORE].put({
                    key,
                    value: entry.value ?? entry,
                    updatedAt: entry.updatedAt ?? now,
                    version: entry.version ?? now
                });
                imported++;
            }

            return { success: true, imported, skipped };
        } catch (error) {
            console.error("[PrimaryDB] ImportAll failed:", error);
            return { success: false, imported: 0, skipped: 0, error: error.message };
        }
    }
};
