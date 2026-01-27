// @ts-check
/**
 * @fileoverview Storage/Sync specific logger using logger.js base.
 * @module utils/logStyles
 */

import { logger } from "../logger.js";

// Extend LOG_STYLES with storage-specific categories
const STORAGE_CATEGORIES = {
  Vault: { color: "#4CAF50", icon: "🔐" },
  Storage: { color: "#FF9800", icon: "💾" },
  Migration: { color: "#9C27B0", icon: "🔄" },
  Sync: { color: "#2196F3", icon: "☁️" },
  Main: { color: "#00BCD4", icon: "🚀" },
};

/**
 * Creates a logger instance for a specific module.
 * @param {string} moduleName - The module name (e.g., "Vault", "Sync", "Migration").
 * @returns {Object} Logger object with styled methods.
 */
export const createLogger = (moduleName) => {
  const config = STORAGE_CATEGORIES[moduleName] || { color: "#9E9E9E", icon: "📝" };
  const style = `font-size: 12px; font-weight: bold; color: ${config.color}; background: #222; padding: 3px 6px; border-radius: 3px;`;

  return {
    /**
     * Logs a Vault-related message.
     * @param {string} message - The message.
     * @param {any} [data] - Optional data.
     */
    vault: (message, data) => {
      console.log(`%c🔐 [${moduleName}] ${message}`, style, data !== undefined ? data : "");
    },

    /**
     * Logs a localStorage-related message.
     * @param {string} message - The message.
     * @param {any} [data] - Optional data.
     */
    localStorage: (message, data) => {
      console.log(`%c💾 [${moduleName}] ${message}`, style, data !== undefined ? data : "");
    },

    /**
     * Logs a migration-related message.
     * @param {string} message - The message.
     * @param {any} [data] - Optional data.
     */
    migration: (message, data) => {
      console.log(`%c🔄 [${moduleName}] ${message}`, style, data !== undefined ? data : "");
    },

    /**
     * Logs a sync-related message.
     * @param {string} message - The message.
     * @param {any} [data] - Optional data.
     */
    sync: (message, data) => {
      console.log(`%c☁️ [${moduleName}] ${message}`, style, data !== undefined ? data : "");
    },

    /**
     * Logs a success message.
     * @param {string} message - The message.
     * @param {any} [data] - Optional data.
     */
    success: (message, data) => {
      console.log(`%c✅ [${moduleName}] ${message}`, style, data !== undefined ? data : "");
    },

    /**
     * Logs an error message.
     * @param {string} message - The message.
     * @param {any} [data] - Optional data.
     */
    error: (message, data) => {
      console.error(`%c❌ [${moduleName}] ${message}`, style, data !== undefined ? data : "");
    },

    /**
     * Logs a warning message.
     * @param {string} message - The message.
     * @param {any} [data] - Optional data.
     */
    warn: (message, data) => {
      console.warn(`%c⚠️ [${moduleName}] ${message}`, style, data !== undefined ? data : "");
    },

    /**
     * Logs an info message.
     * @param {string} message - The message.
     * @param {any} [data] - Optional data.
     */
    info: (message, data) => {
      console.log(`%cℹ️ [${moduleName}] ${message}`, style, data !== undefined ? data : "");
    },

    /**
     * Creates a collapsible group.
     * @param {string} title - The group title.
     * @param {boolean} [collapsed=true] - Whether to start collapsed.
     */
    group: (title, collapsed = true) => {
      logger.group(moduleName, title, collapsed);
    },

    /**
     * Ends a collapsible group.
     */
    groupEnd: () => {
      logger.groupEnd();
    },

    /**
     * Logs data as a table.
     * @param {any} data - The data to display.
     */
    table: (data) => {
      logger.table(data);
    },
  };
};

// Re-export base logger for convenience
export { logger };
