export const core = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item === null ? defaultValue : item;
        } catch (e) {
            console.warn('[Storage:core] Read error:', key, e);
            return defaultValue;
        }
    },

    getJSON(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (e) {
            console.warn('[Storage:core] JSON parse error:', key, e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, String(value));
            return { success: true };
        } catch (e) {
            console.warn('[Storage:core] Write error:', key, e);
            return { success: false, error: e.message };
        }
    },

    setJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return { success: true };
        } catch (e) {
            console.warn('[Storage:core] JSON stringify error:', key, e);
            return { success: false, error: e.message };
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return { success: true };
        } catch (e) {
            console.warn('[Storage:core] Remove error:', key, e);
            return { success: false, error: e.message };
        }
    },

    removeByPrefix(prefix) {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            return { success: true, count: keysToRemove.length };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    getAllKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('wwm_')) {
                keys.push(key);
            }
        }
        return keys;
    },

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
            kb: Math.round(total / 1024 * 100) / 100,
            mb: Math.round(total / 1024 / 1024 * 100) / 100
        };
    }
};

const XOR_KEY = 0x42;

const encodeValue = (plainText) => {
    if (!plainText) return '';
    try {
        const xored = plainText.split('')
            .map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY))
            .join('');
        return btoa(xored);
    } catch (e) {
        return btoa(plainText);
    }
};

const decodeValue = (encodedText) => {
    if (!encodedText) return '';
    try {
        if (encodedText.startsWith('AIza') || encodedText.startsWith('sk-')) {
            return encodedText;
        }
        const decoded = atob(encodedText);
        return decoded.split('')
            .map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY))
            .join('');
    } catch (e) {
        return encodedText;
    }
};

export const encoded = {
    encode: encodeValue,
    decode: decodeValue,

    set(key, plainValue) {
        return core.set(key, encodeValue(plainValue));
    },

    get(key, defaultValue = '') {
        const encodedValue = core.get(key, null);
        if (encodedValue === null) return defaultValue;
        return decodeValue(encodedValue);
    }
};

export const transaction = {
    saveMultiple(entries) {
        const backup = {};
        const results = [];

        try {
            for (const { key } of entries) {
                backup[key] = localStorage.getItem(key);
            }

            for (const { key, value, isJSON } of entries) {
                const result = isJSON
                    ? core.setJSON(key, value)
                    : core.set(key, value);

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
    }
};
