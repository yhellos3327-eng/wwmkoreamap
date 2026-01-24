// @ts-check
/**
 * @fileoverview Dexie.js wrapper for persistent storage vault.
 * @module storage/db
 */

// @ts-ignore
import { Dexie } from 'https://unpkg.com/dexie/dist/modern/dexie.mjs';

const DB_NAME = "WwmVaultDB";
const STORE_NAME = "backups";

// Initialize Dexie database
const dexieDb = new Dexie(DB_NAME);

// Define schema
dexieDb.version(1).stores({
    [STORE_NAME]: '++id, timestamp, reason'
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
