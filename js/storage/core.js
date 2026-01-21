// @ts-check

/**
 * @typedef {Object} OperationResult
 * @property {boolean} success - Whether the operation succeeded.
 * @property {string} [error] - Error message if failed.
 * @property {number} [count] - Count of affected items.
 */

/**
 * Core localStorage operations with error handling.
 */
export const core = {
  /**
   * Gets a value from localStorage.
   * @param {string} key - The storage key.
   * @param {any} [defaultValue=null] - Default value if not found.
   * @returns {string|null} The stored value or default.
   */
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item === null ? defaultValue : item;
    } catch (e) {
      console.warn("[Storage:core] Read error:", key, e);
      return defaultValue;
    }
  },

  /**
   * Gets and parses JSON from localStorage.
   * @param {string} key - The storage key.
   * @param {any} [defaultValue=null] - Default value if not found or invalid.
   * @returns {any} The parsed value or default.
   */
  getJSON(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (e) {
      console.warn("[Storage:core] JSON parse error:", key, e);
      return defaultValue;
    }
  },

  /**
   * Sets a value in localStorage.
   * @param {string} key - The storage key.
   * @param {any} value - The value to store.
   * @returns {OperationResult} The operation result.
   */
  set(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return { success: true };
    } catch (e) {
      console.warn("[Storage:core] Write error:", key, e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Stringifies and sets JSON in localStorage.
   * @param {string} key - The storage key.
   * @param {any} value - The value to store.
   * @returns {OperationResult} The operation result.
   */
  setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { success: true };
    } catch (e) {
      console.warn("[Storage:core] JSON stringify error:", key, e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Removes a key from localStorage.
   * @param {string} key - The storage key.
   * @returns {OperationResult} The operation result.
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return { success: true };
    } catch (e) {
      console.warn("[Storage:core] Remove error:", key, e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Removes all keys with a given prefix.
   * @param {string} prefix - The key prefix.
   * @returns {OperationResult} The operation result with count.
   */
  removeByPrefix(prefix) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      return { success: true, count: keysToRemove.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Gets all wwm_ prefixed keys.
   * @returns {string[]} Array of storage keys.
   */
  getAllKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("wwm_")) {
        keys.push(key);
      }
    }
    return keys;
  },

  /**
   * Gets storage usage statistics.
   * @returns {{bytes: number, kb: number, mb: number}} Usage stats.
   */
  getUsage() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        total += key.length + (value?.length || 0);
      }
    }
    return {
      bytes: total,
      kb: Math.round((total / 1024) * 100) / 100,
      mb: Math.round((total / 1024 / 1024) * 100) / 100,
    };
  },
};

/** @type {number} */
const XOR_KEY = 0x42;

/**
 * Encodes a value using XOR and base64.
 * @param {string} plainText - The text to encode.
 * @returns {string} The encoded text.
 */
const encodeValue = (plainText) => {
  if (!plainText) return "";
  try {
    const xored = plainText
      .split("")
      .map((c) => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY))
      .join("");
    return btoa(xored);
  } catch (e) {
    return btoa(plainText);
  }
};

/**
 * Decodes a value from XOR and base64.
 * @param {string} encodedText - The encoded text.
 * @returns {string} The decoded text.
 */
const decodeValue = (encodedText) => {
  if (!encodedText) return "";
  try {
    if (encodedText.startsWith("AIza") || encodedText.startsWith("sk-")) {
      return encodedText;
    }
    const decoded = atob(encodedText);
    return decoded
      .split("")
      .map((c) => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY))
      .join("");
  } catch (e) {
    return encodedText;
  }
};

/**
 * Encoded storage operations for sensitive data.
 */
export const encoded = {
  encode: encodeValue,
  decode: decodeValue,

  /**
   * Sets an encoded value.
   * @param {string} key - The storage key.
   * @param {string} plainValue - The plain value.
   * @returns {OperationResult} The operation result.
   */
  set(key, plainValue) {
    return core.set(key, encodeValue(plainValue));
  },

  /**
   * Gets and decodes a value.
   * @param {string} key - The storage key.
   * @param {string} [defaultValue=''] - Default value.
   * @returns {string} The decoded value.
   */
  get(key, defaultValue = "") {
    const encodedForValue = core.get(key, null);
    if (encodedForValue === null) return defaultValue;
    return decodeValue(encodedForValue);
  },
};

/**
 * Transaction operations for atomic multi-key saves.
 */
export const transaction = {
  /**
   * Saves multiple entries atomically with rollback on failure.
   * @param {Array<{key: string, value: any, isJSON?: boolean}>} entries - Entries to save.
   * @returns {{success: boolean, results: any[], error?: string}} The result.
   */
  saveMultiple(entries) {
    /** @type {Object<string, string|null>} */
    const backup = {};
    const results = [];

    try {
      for (const { key } of entries) {
        backup[key] = localStorage.getItem(key);
      }

      for (const { key, value, isJSON } of entries) {
        const result = isJSON ? core.setJSON(key, value) : core.set(key, value);

        results.push({ key, ...result });

        if (!result.success) {
          throw new Error(`Failed to save ${key}: ${result.error}`);
        }
      }

      return { success: true, results };
    } catch (e) {
      for (const [key, value] of Object.entries(backup)) {
        if (value === null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, value);
        }
      }
      return { success: false, error: e.message, results };
    }
  },
};
