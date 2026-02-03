// @ts-check
/**
 * @fileoverview Storage schema module - defines schema for localStorage keys and validation.
 * @module storage/schema
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed.
 * @property {string} [message] - Error message if invalid.
 * @property {any[]} [invalidItems] - Invalid items if applicable.
 * @property {boolean} [canAutoClean] - Whether invalid items can be auto-cleaned.
 * @property {boolean} [unknown] - Whether the key is unknown.
 */

/**
 * @typedef {Object} SchemaEntry
 * @property {string} type - Data type ('array', 'object', 'string', 'number', 'boolean', 'encoded').
 * @property {any} [defaultValue] - Default value for this key.
 * @property {boolean} [snapshot] - Whether to include in snapshots.
 * @property {RegExp} [pattern] - Pattern for wildcard keys.
 * @property {boolean} [internal] - Whether this is internal data.
 * @property {Function} [validate] - Custom validation function.
 * @property {Function} [transform] - Transform function before save.
 * @property {Function} [parse] - Parse function after load.
 */

/**
 * Type validators.
 */
const validators = {
  /** @param {any} v */
  isArray: (v) => Array.isArray(v),
  /** @param {any} v */
  isObject: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  /** @param {any} v */
  isString: (v) => typeof v === "string",
  /** @param {any} v */
  isNumber: (v) => typeof v === "number" && !isNaN(v),
  /** @param {any} v */
  isBoolean: (v) => typeof v === "boolean",
  /** @param {any} v */
  isStringArray: (v) =>
    Array.isArray(v) && v.every((item) => typeof item === "string"),
  /** @param {any} v */
  isNumericStringArray: (v) =>
    Array.isArray(v) &&
    v.every((item) => typeof item === "string" && /^\d+$/.test(item)),
  /** @param {any} v */
  isCompletedMarkerArray: (v) => {
    if (!Array.isArray(v)) return false;
    return v.every((item) => {
      if (
        typeof item === "number" ||
        (typeof item === "string" && /^\d+$/.test(item))
      ) {
        return true;
      }
      if (item && typeof item === "object" && item.id !== undefined) {
        return (
          typeof item.id === "number" ||
          (typeof item.id === "string" && /^\d+$/.test(item.id))
        );
      }
      return false;
    });
  },
};

/**
 * Storage schema definitions.
 * @type {Object<string, SchemaEntry>}
 */
export const SCHEMA = {
  // Vault Keys
  completedList: {
    type: "array",
    defaultValue: [],
    snapshot: true,
    validate: (v) => {
      // New format is array of objects {id, completedAt}
      if (!Array.isArray(v)) return { valid: false, message: "배열이 아닙니다" };
      return { valid: true };
    },
  },
  favorites: {
    type: "array",
    defaultValue: [],
    snapshot: true,
    validate: (v) => {
      if (!validators.isArray(v)) return { valid: false, message: "배열이 아닙니다" };
      return { valid: true };
    },
  },
  settings: {
    type: "object",
    defaultValue: {},
    snapshot: true,
  },
  "activeCats_*": {
    type: "array",
    defaultValue: [],
    snapshot: true,
    pattern: /^activeCats_(.+)$/,
  },
  "activeRegs_*": {
    type: "array",
    defaultValue: [],
    snapshot: true,
    pattern: /^activeRegs_(.+)$/,
  },

  // Legacy Keys (kept for compatibility/migration)
  wwm_completed: {
    type: "array",
    defaultValue: [],
    snapshot: true,
    validate: (v) => {
      if (!validators.isCompletedMarkerArray(v)) {
        return { valid: false, message: "유효하지 않은 완료 마커 형식" };
      }
      return { valid: true };
    },
  },

  wwm_favorites: {
    type: "array",
    defaultValue: [],
    snapshot: true,
    validate: (v) => {
      if (!validators.isArray(v)) {
        return { valid: false, message: "배열이 아닙니다" };
      }
      return { valid: true };
    },
  },

  "wwm_active_cats_*": {
    type: "array",
    defaultValue: [],
    pattern: /^wwm_active_cats_(.+)$/,
    snapshot: true,
    validate: (v) => {
      if (!validators.isNumericStringArray(v)) {
        return {
          valid: false,
          message: "카테고리 ID는 숫자 문자열 배열이어야 합니다",
        };
      }
      return { valid: true };
    },
    transform: (v) => (Array.isArray(v) ? v.map(String) : []),
  },

  "wwm_active_regs_*": {
    type: "array",
    defaultValue: [],
    pattern: /^wwm_active_regs_(.+)$/,
    snapshot: true,
    validate: (v, context) => {
      if (!validators.isStringArray(v)) {
        return { valid: false, message: "지역명은 문자열 배열이어야 합니다" };
      }
      if (context?.validRegions) {
        const invalid = v.filter((r) => !context.validRegions.has(r));
        if (invalid.length > 0) {
          return {
            valid: false,
            message: `존재하지 않는 지역: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "..." : ""}`,
            invalidItems: invalid,
            canAutoClean: true,
          };
        }
      }
      return { valid: true };
    },
  },

  "wwm_favorites_*": {
    type: "array",
    defaultValue: [],
    pattern: /^wwm_favorites_(.+)$/,
    snapshot: true,
    validate: (v) =>
      validators.isArray(v)
        ? { valid: true }
        : { valid: false, message: "배열이 아닙니다" },
  },

  wwm_show_comments: {
    type: "boolean",
    defaultValue: true,
    parse: (v) => v !== "false",
  },

  wwm_close_on_complete: {
    type: "boolean",
    defaultValue: false,
    parse: (v) => v === "true",
  },

  wwm_hide_completed: {
    type: "boolean",
    defaultValue: false,
    parse: (v) => v === "true",
  },

  wwm_enable_clustering: {
    type: "boolean",
    defaultValue: true,
    parse: (v) => v !== "false",
  },

  wwm_show_ad: {
    type: "boolean",
    defaultValue: true,
    parse: (v) => v !== "false",
  },

  wwm_ai_provider: {
    type: "string",
    defaultValue: "gemini",
  },

  wwm_api_model: {
    type: "string",
    defaultValue: "gemini-1.5-flash",
  },

  wwm_region_color: {
    type: "string",
    defaultValue: "#242424",
  },

  wwm_region_fill_color: {
    type: "string",
    defaultValue: "#ffbd53",
  },

  wwm_menu_position: {
    type: "string",
    defaultValue: "center",
  },

  wwm_gpu_setting: {
    type: "string",
    defaultValue: "auto",
  },

  wwm_api_key: { type: "encoded", defaultValue: "" },
  wwm_openai_key: { type: "encoded", defaultValue: "" },
  wwm_claude_key: { type: "encoded", defaultValue: "" },

  wwm_cleanup_last_run: {
    type: "string",
    defaultValue: "0",
    validate: (v) =>
      typeof v === "string" && /^\d+$/.test(v)
        ? { valid: true }
        : { valid: false, message: "숫자 형식의 문자열이 아닙니다" },
    parse: (v) => String(v),
  },

  wwm_settings_updated_at: {
    type: "object",
    defaultValue: {},
    snapshot: true,
  },
  wwm_last_known_good: { type: "object", internal: true },
  wwm_restore_failure_log: { type: "array", internal: true },
  "wwm_notice_hidden_*": {
    type: "string",
    pattern: /^wwm_notice_hidden_(.+)$/,
  },
};

/**
 * Gets the schema for a given key.
 * @param {string} key - The storage key.
 * @returns {(SchemaEntry & {key: string, matchedPattern?: string})|null} Schema or null.
 */
export const getSchema = (key) => {
  if (SCHEMA[key]) {
    return { ...SCHEMA[key], key };
  }

  for (const [pattern, rule] of Object.entries(SCHEMA)) {
    if (rule.pattern && rule.pattern.test(key)) {
      return { ...rule, key, matchedPattern: pattern };
    }
  }

  return null;
};

/**
 * Gets static snapshot keys (without wildcards).
 * @returns {string[]} Array of keys.
 */
export const getSnapshotKeys = () => {
  const keys = [];
  for (const [key, rule] of Object.entries(SCHEMA)) {
    if (rule.snapshot && !key.includes("*")) {
      keys.push(key);
    }
  }
  return keys;
};

/**
 * Gets all current snapshot keys from localStorage.
 * @returns {Promise<string[]>} Array of keys.
 */
export const getCurrentSnapshotKeys = async () => {
  const keys = [];
  const staticKeys = getSnapshotKeys();
  keys.push(...staticKeys);

  const { primaryDb } = await import("./db.js");
  const dbKeys = await primaryDb.getAllKeys();

  for (const key of dbKeys) {
    const schema = getSchema(key);
    if (schema?.snapshot && !keys.includes(key)) {
      keys.push(key);
    }
  }

  return keys;
};

/**
 * Validates a value against its schema.
 * @param {string} key - The storage key.
 * @param {any} value - The value to validate.
 * @param {Object} [context={}] - Validation context.
 * @returns {ValidationResult} Validation result.
 */
export const validateValue = (key, value, context = {}) => {
  const schema = getSchema(key);

  if (!schema) {
    return { valid: true, unknown: true };
  }

  const typeValid = checkType(schema.type, value);
  if (!typeValid.valid) {
    return typeValid;
  }

  if (schema.validate) {
    return schema.validate(value, context);
  }

  return { valid: true };
};

/**
 * Checks if a value matches the expected type.
 * @param {string} type - Expected type.
 * @param {any} value - Value to check.
 * @returns {ValidationResult} Check result.
 */
const checkType = (type, value) => {
  switch (type) {
    case "array":
      return validators.isArray(value)
        ? { valid: true }
        : { valid: false, message: "배열 형식이 아닙니다" };
    case "object":
      return validators.isObject(value)
        ? { valid: true }
        : { valid: false, message: "객체 형식이 아닙니다" };
    case "string":
      return validators.isString(value)
        ? { valid: true }
        : { valid: false, message: "문자열이 아닙니다" };
    case "number":
      return validators.isNumber(value)
        ? { valid: true }
        : { valid: false, message: "숫자가 아닙니다" };
    case "boolean":
      return validators.isBoolean(value)
        ? { valid: true }
        : { valid: false, message: "불리언이 아닙니다" };
    case "encoded":
      return { valid: true };
    default:
      return { valid: true };
  }
};

/**
 * Transforms a value before saving.
 * @param {string} key - The storage key.
 * @param {any} value - The value to transform.
 * @returns {any} Transformed value.
 */
export const transformForSave = (key, value) => {
  const schema = getSchema(key);
  if (schema?.transform) {
    return schema.transform(value);
  }
  return value;
};

/**
 * Parses a value after loading from storage.
 * @param {string} key - The storage key.
 * @param {string} rawValue - The raw string value.
 * @returns {any} Parsed value.
 */
export const parseAfterLoad = (key, rawValue) => {
  const schema = getSchema(key);
  if (schema?.parse) {
    return schema.parse(rawValue);
  }

  if (schema?.type === "boolean") {
    return rawValue === "true";
  }
  if (schema?.type === "number") {
    return Number(rawValue);
  }

  return rawValue;
};
