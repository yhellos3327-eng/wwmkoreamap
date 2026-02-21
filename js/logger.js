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
 * 콘솔 출력을 위한 로그 스타일 객체를 생성합니다.
 * @param {string} category - 로그 카테고리.
 * @returns {{style: string, icon: string}} 스타일 객체.
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
   * 카테고리 스타일이 적용된 메시지를 출력합니다.
   * @param {string} category - 로그 카테고리.
   * @param {string} message - 출력할 메시지.
   * @param {...any} args - 추가 인수.
   */
  log: (category, message, ...args) => {
    const { style, icon } = createLogStyle(category);
    console.log(`%c${icon} [${category}] ${message}`, style, ...args);
  },

  /**
   * 콘솔 그룹을 시작합니다.
   * @param {string} category - 로그 카테고리.
   * @param {string} message - 그룹 제목.
   * @param {boolean} [collapsed=true] - 그룹 접힘 여부.
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
   * 현재 콘솔 그룹을 종료합니다.
   */
  groupEnd: () => {
    console.groupEnd();
  },

  /**
   * 타이머를 시작합니다.
   * @param {string} category - 로그 카테고리.
   * @param {string} label - 타이머 라벨.
   * @returns {string} 전체 타이머 라벨.
   */
  time: (category, label) => {
    const timerLabel = `[${category}] ${label}`;
    console.time(timerLabel);
    return timerLabel;
  },

  /**
   * 타이머를 종료합니다.
   * @param {string} timerLabel - time()에서 반환된 타이머 라벨.
   */
  timeEnd: (timerLabel) => {
    console.timeEnd(timerLabel);
  },

  /**
   * 성공 메시지를 출력합니다.
   * @param {string} category - 로그 카테고리.
   * @param {string} message - 출력할 메시지.
   * @param {...any} args - 추가 인수.
   */
  success: (category, message, ...args) => {
    const { style, icon } = createLogStyle(category);
    console.log(`%c${icon} [${category}] ✅ ${message}`, style, ...args);
  },

  /**
   * 경고 메시지를 출력합니다.
   * @param {string} category - 로그 카테고리.
   * @param {string} message - 출력할 메시지.
   * @param {...any} args - 추가 인수.
   */
  warn: (category, message, ...args) => {
    const { style, icon } = createLogStyle(category);
    console.warn(`%c${icon} [${category}] ${message}`, style, ...args);
  },

  /**
   * 오류 메시지를 출력합니다.
   * @param {string} category - 로그 카테고리.
   * @param {string} message - 출력할 메시지.
   * @param {...any} args - 추가 인수.
   */
  error: (category, message, ...args) => {
    const { style, icon } = createLogStyle(category);
    console.error(`%c${icon} [${category}] ${message}`, style, ...args);
  },

  /**
   * 데이터를 테이블로 출력합니다.
   * @param {any} data - 테이블에 표시할 데이터.
   */
  table: (data) => {
    console.table(data);
  },

  /**
   * 상태 변경 이벤트를 로그에 기록합니다.
   * @param {string} key - 상태 키.
   * @param {any} oldValue - 이전 값.
   * @param {any} newValue - 새로운 값.
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
   * 성능 타이머를 시작합니다.
   * @param {string} category - 로그 카테고리.
   * @param {string} label - 타이머 라벨.
   * @returns {string} 타이머 키.
   */
  start: (category, label) => {
    const key = `${category}:${label}`;
    perfTimer.timers[key] = performance.now();
    return key;
  },

  /**
   * 성능 타이머를 종료하고 소요 시간을 출력합니다.
   * @param {string} key - start()에서 반환된 타이머 키.
   * @returns {number} 밀리초 단위의 소요 시간.
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
