const LOG_STYLES = {
    'Pub/Sub': { color: '#4CAF50', icon: '🔄' },
    'Worker': { color: '#2196F3', icon: '⚙️' },
    'Performance': { color: '#FF9800', icon: '⚡' },
    'LazyLoading': { color: '#9C27B0', icon: '🔮' },
    'WorkerManager': { color: '#00BCD4', icon: '🛠️' },
    'Firebase': { color: '#FFCA28', icon: '🔥' },
    'Comments': { color: '#E91E63', icon: '💬' },
    'BadWords': { color: '#F44336', icon: '🚫' },
    'Cleanup': { color: '#795548', icon: '🧹' },
    'Filter': { color: '#607D8B', icon: '🎯' },
    'Navigation': { color: '#8BC34A', icon: '🚀' },
    'Cache': { color: '#009688', icon: '📦' },
    'Data': { color: '#3F51B5', icon: '📊' }
};

const createLogStyle = (category) => {
    const config = LOG_STYLES[category] || { color: '#9E9E9E', icon: '📝' };
    return {
        style: `font-size: 12px; font-weight: bold; color: ${config.color}; background: #222; padding: 3px 6px; border-radius: 3px;`,
        icon: config.icon
    };
};

export const logger = {
    log: (category, message, ...args) => {
        const { style, icon } = createLogStyle(category);
        console.log(`%c${icon} [${category}] ${message}`, style, ...args);
    },

    group: (category, message, collapsed = true) => {
        const { style, icon } = createLogStyle(category);
        if (collapsed) {
            console.groupCollapsed(`%c${icon} [${category}] ${message}`, style);
        } else {
            console.group(`%c${icon} [${category}] ${message}`, style);
        }
    },

    groupEnd: () => {
        console.groupEnd();
    },

    time: (category, label) => {
        const timerLabel = `[${category}] ${label}`;
        console.time(timerLabel);
        return timerLabel;
    },

    timeEnd: (timerLabel) => {
        console.timeEnd(timerLabel);
    },

    success: (category, message, ...args) => {
        const { style, icon } = createLogStyle(category);
        console.log(`%c${icon} [${category}] ✅ ${message}`, style, ...args);
    },

    warn: (category, message, ...args) => {
        const { style, icon } = createLogStyle(category);
        console.warn(`%c${icon} [${category}] ${message}`, style, ...args);
    },

    error: (category, message, ...args) => {
        const { style, icon } = createLogStyle(category);
        console.error(`%c${icon} [${category}] ${message}`, style, ...args);
    },

    table: (data) => {
        console.table(data);
    },

    stateChange: (key, oldValue, newValue) => {
        const { style, icon } = createLogStyle('Pub/Sub');
        console.groupCollapsed(`%c${icon} [Pub/Sub] 상태 변경: ${key}`, style);
        console.log(`이전 값:`, oldValue);
        console.log(`새로운 값:`, newValue);
        console.groupEnd();
    }
};

export const perfTimer = {
    timers: {},

    start: (category, label) => {
        const key = `${category}:${label}`;
        perfTimer.timers[key] = performance.now();
        return key;
    },

    end: (key) => {
        const endTime = performance.now();
        const startTime = perfTimer.timers[key];
        if (startTime) {
            const duration = (endTime - startTime).toFixed(2);
            const [category, label] = key.split(':');
            logger.log(category, `${label}: ${duration}ms`);
            delete perfTimer.timers[key];
            return parseFloat(duration);
        }
        return 0;
    }
};
