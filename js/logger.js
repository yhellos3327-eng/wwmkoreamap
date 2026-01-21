// @ts-check

/**
 * @typedef {Object} LogStyle
 * @property {string} color - Hex color code
 * @property {string} icon - Emoji icon
 */

/** @type {Object.<string, LogStyle>} */
const LOG_STYLES = {
  "Pub/Sub": { color: "#4CAF50", icon: "🔄" },
  Worker: { color: "#2196F3", icon: "⚙️" },
  Performance: { color: "#FF9800", icon: "⚡" },
  LazyLoading: { color: "#9C27B0", icon: "🔮" },
  WebWorkerManager: { color: "#00BCD4", icon: "🛠️" },
  Firebase: { color: "#FFCA28", icon: "🔥" },
  Comments: { color: "#E91E63", icon: "💬" },
  BadWords: { color: "#F44336", icon: "🚫" },
  Cleanup: { color: "#795548", icon: "🧹" },
  Filter: { color: "#607D8B", icon: "🎯" },
  Navigation: { color: "#8BC34A", icon: "🚀" },
  Cache: { color: "#009688", icon: "📦" },
  Data: { color: "#3F51B5", icon: "📊" },
};

/**
 * Creates a log style object for console output.
 * @param {string} category - The log category.
 * @returns {{style: string, icon: string}} The style object.
 */
const createLogStyle = (category) => {
  const config = LOG_STYLES[category] || { color: "#9E9E9E", icon: "📝" };
  return {
    style: `font-size: 12px; font-weight: bold; color: ${config.color}; background: #222; padding: 3px 6px; border-radius: 3px;`,
    icon: config.icon,
  };
};

export const logger = {
  /**
   * Logs a message with a category style.
   * @param {string} category - The log category.
   * @param {string} message - The message to log.
   * @param {...any} args - Additional arguments.
   */
  log: (category, message, ...args) => {
    const { style, icon } = createLogStyle(category);
    console.log(`%c${icon} [${category}] ${message}`, style, ...args);
  },

  /**
   * Starts a console group.
   * @param {string} category - The log category.
   * @param {string} message - The group title.
   * @param {boolean} [collapsed=true] - Whether the group is collapsed.
   */
  group: (category, message, collapsed = true) => {
    const { style, icon } = createLogStyle(category);
    if (collapsed) {
      console.groupCollapsed(`%c${icon} [${category}] ${message}`, style);
    } else {
      console.group(`%c${icon} [${category}] ${message}`, style);
    }
  },

  /**
   * Ends the current console group.
   */
  groupEnd: () => {
    console.groupEnd();
  },

  /**
   * Starts a timer.
   * @param {string} category - The log category.
   * @param {string} label - The timer label.
   * @returns {string} The full timer label.
   */
  time: (category, label) => {
    const timerLabel = `[${category}] ${label}`;
    console.time(timerLabel);
    return timerLabel;
  },

  /**
   * Ends a timer.
   * @param {string} timerLabel - The timer label returned by time().
   */
  timeEnd: (timerLabel) => {
    console.timeEnd(timerLabel);
  },

  /**
   * Logs a success message.
   * @param {string} category - The log category.
   * @param {string} message - The message to log.
   * @param {...any} args - Additional arguments.
   */
  success: (category, message, ...args) => {
    const { style, icon } = createLogStyle(category);
    console.log(`%c${icon} [${category}] ✅ ${message}`, style, ...args);
  },

  /**
   * Logs a warning message.
   * @param {string} category - The log category.
   * @param {string} message - The message to log.
   * @param {...any} args - Additional arguments.
   */
  warn: (category, message, ...args) => {
    const { style, icon } = createLogStyle(category);
    console.warn(`%c${icon} [${category}] ${message}`, style, ...args);
  },

  /**
   * Logs an error message.
   * @param {string} category - The log category.
   * @param {string} message - The message to log.
   * @param {...any} args - Additional arguments.
   */
  error: (category, message, ...args) => {
    const { style, icon } = createLogStyle(category);
    console.error(`%c${icon} [${category}] ${message}`, style, ...args);
  },

  /**
   * Logs data as a table.
   * @param {any} data - The data to display in a table.
   */
  table: (data) => {
    console.table(data);
  },

  /**
   * Logs a state change event.
   * @param {string} key - The state key.
   * @param {any} oldValue - The old value.
   * @param {any} newValue - The new value.
   */
  stateChange: (key, oldValue, newValue) => {
    const { style, icon } = createLogStyle("Pub/Sub");
    console.groupCollapsed(`%c${icon} [Pub/Sub] 상태 변경: ${key}`, style);
    console.log(`이전 값:`, oldValue);
    console.log(`새로운 값:`, newValue);
    console.groupEnd();
  },
};

export const perfTimer = {
  /** @type {Object.<string, number>} */
  timers: {},

  /**
   * Starts a performance timer.
   * @param {string} category - The log category.
   * @param {string} label - The timer label.
   * @returns {string} The timer key.
   */
  start: (category, label) => {
    const key = `${category}:${label}`;
    perfTimer.timers[key] = performance.now();
    return key;
  },

  /**
   * Ends a performance timer and logs the duration.
   * @param {string} key - The timer key returned by start().
   * @returns {number} The duration in milliseconds.
   */
  end: (key) => {
    const endTime = performance.now();
    const startTime = perfTimer.timers[key];
    if (startTime) {
      const duration = (endTime - startTime).toFixed(2);
      const [category, label] = key.split(":");
      logger.log(category, `${label}: ${duration}ms`);
      delete perfTimer.timers[key];
      return parseFloat(duration);
    }
    return 0;
  },
};
