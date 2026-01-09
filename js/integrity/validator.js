const CURRENT_DATA_VERSION = 1;

const SEVERITY = Object.freeze({
    FATAL: 'fatal',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
});

const STATUS = Object.freeze({
    PASS: 'pass',
    FAIL: 'fail',
    SKIP: 'skip',
    WARN: 'warn'
});

export const createResult = () => ({
    timestamp: Date.now(),
    mode: 'soft',
    canRestore: true,
    autoCleanApplied: false,

    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        cleaned: 0
    },

    issues: [],
    cleaned: [],
    steps: {}
});

export const addIssue = (result, issue) => {
    result.issues.push({
        ...issue,
        timestamp: Date.now()
    });

    result.summary.total++;

    if (issue.severity === SEVERITY.FATAL || issue.severity === SEVERITY.ERROR) {
        result.summary.failed++;
        if (issue.severity === SEVERITY.FATAL) {
            result.canRestore = false;
        }
    } else if (issue.severity === SEVERITY.WARNING) {
        result.summary.warnings++;
    }
};

export const addCleaned = (result, cleaned) => {
    result.cleaned.push(cleaned);
    result.summary.cleaned++;
    result.autoCleanApplied = true;
};

export const validateStructure = (data) => {
    const issues = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, issues: ['데이터가 유효한 객체가 아닙니다'], fatal: true };
    }

    if (data.completedMarkers !== undefined && !Array.isArray(data.completedMarkers)) {
        issues.push('completedMarkers가 배열이 아닙니다');
    }

    if (data.favorites !== undefined && !Array.isArray(data.favorites)) {
        issues.push('favorites가 배열이 아닙니다');
    }

    if (data.settings !== undefined && (typeof data.settings !== 'object' || data.settings === null)) {
        issues.push('settings가 유효한 객체가 아닙니다');
    }

    return { valid: issues.length === 0, issues, fatal: false };
};

export const validateVersion = (data, currentVersion = 1) => {
    if (data.version === undefined) {
        return {
            valid: true,
            legacy: true,
            message: '버전 정보가 없는 레거시 데이터'
        };
    }

    if (data.version > currentVersion) {
        return {
            valid: true,
            futureVersion: true,
            message: `현재 버전(${currentVersion})보다 높은 데이터 버전(${data.version})`
        };
    }

    return { valid: true };
};

export const validateCompletedMarkers = (markers, context = {}) => {
    const result = {
        valid: true,
        validCount: 0,
        invalidCount: 0,
        issues: [],
        invalidItems: []
    };

    if (!markers || !Array.isArray(markers)) {
        return { ...result, skip: true };
    }

    const hasMarkerData = context.validMarkerIds?.size > 0;

    for (let i = 0; i < markers.length; i++) {
        const marker = markers[i];
        let markerId = null;
        let error = null;

        if (typeof marker === 'number' || (typeof marker === 'string' && /^\d+$/.test(marker))) {
            markerId = String(marker);
        } else if (marker && typeof marker === 'object' && marker.id !== undefined) {
            markerId = String(marker.id);
        } else {
            error = '잘못된 형식';
        }

        if (!error && markerId) {
            if (!/^\d+$/.test(markerId)) {
                error = 'ID가 숫자가 아님';
            } else if (hasMarkerData && !context.validMarkerIds.has(markerId)) {
                error = '존재하지 않는 마커 ID';
            }
        }

        if (error) {
            result.invalidCount++;
            result.invalidItems.push({ index: i, id: markerId, error });
            if (result.issues.length < 3) {
                result.issues.push(`항목 ${i + 1} (ID: ${markerId || 'unknown'}): ${error}`);
            }
        } else {
            result.validCount++;
        }
    }

    result.valid = result.invalidCount === 0;
    return result;
};

export const validateFavorites = (favorites, context = {}) => {
    const result = {
        valid: true,
        validCount: 0,
        invalidCount: 0,
        issues: [],
        invalidItems: []
    };

    if (!favorites || !Array.isArray(favorites)) {
        return { ...result, skip: true };
    }

    const hasMarkerData = context.validMarkerIds?.size > 0;

    for (let i = 0; i < favorites.length; i++) {
        const fav = favorites[i];
        let favId = null;
        let error = null;

        if (typeof fav === 'number' || (typeof fav === 'string' && /^\d+$/.test(fav))) {
            favId = String(fav);
        } else if (fav && typeof fav === 'object' && fav.id !== undefined) {
            favId = String(fav.id);
        } else {
            error = '잘못된 형식';
        }

        if (!error && favId && hasMarkerData && !context.validMarkerIds.has(favId)) {
            error = '존재하지 않는 마커 ID';
        }

        if (error) {
            result.invalidCount++;
            result.invalidItems.push({ index: i, id: favId, error });
        } else {
            result.validCount++;
        }
    }

    result.valid = result.invalidCount === 0;
    return result;
};

export const validateSettings = (settings, context = {}, options = {}) => {
    const result = {
        valid: true,
        count: 0,
        invalidCount: 0,
        issues: [],
        cleaned: []
    };

    if (!settings || typeof settings !== 'object') {
        return { ...result, skip: true };
    }

    const ignoredKeys = ['_updatedAt'];

    for (const [key, value] of Object.entries(settings)) {
        if (ignoredKeys.includes(key)) continue;

        result.count++;

        const storageKey = settingKeyToStorageKey(key);
        const validation = validateValue(storageKey, value, context);

        if (!validation.valid) {
            if (validation.canAutoClean && options.autoClean && validation.invalidItems) {
                const cleanedValue = value.filter(item =>
                    !validation.invalidItems.includes(item)
                );
                settings[key] = cleanedValue;
                result.cleaned.push({
                    key,
                    removed: validation.invalidItems,
                    remaining: cleanedValue.length
                });
            } else {
                result.invalidCount++;
                result.issues.push({
                    key,
                    message: validation.message,
                    canAutoClean: validation.canAutoClean || false
                });
            }
        }
    }

    result.valid = result.invalidCount === 0;
    return result;
};

const settingKeyToStorageKey = (key) => {
    if (key.startsWith('activeCats')) {
        const mapKey = key.replace('activeCats', '').toLowerCase() || 'qinghe';
        return `wwm_active_cats_${mapKey}`;
    }
    if (key.startsWith('activeRegs')) {
        const mapKey = key.replace('activeRegs', '').toLowerCase() || 'qinghe';
        return `wwm_active_regs_${mapKey}`;
    }

    const mapping = {
        showAd: 'wwm_show_ad',
        showComments: 'wwm_show_comments',
        hideCompleted: 'wwm_hide_completed',
        enableClustering: 'wwm_enable_clustering',
        closeOnComplete: 'wwm_close_on_complete'
    };

    return mapping[key] || key;
};

const validateValue = (key, value, context = {}) => {
    if (key.startsWith('wwm_active_cats_')) {
        if (!Array.isArray(value)) {
            return { valid: false, message: '카테고리 ID는 배열이어야 합니다' };
        }
        const invalid = value.filter(item => typeof item !== 'string' || !/^\d+$/.test(item));
        if (invalid.length > 0) {
            return { valid: false, message: '유효하지 않은 카테고리 ID 포함' };
        }
        return { valid: true };
    }

    if (key.startsWith('wwm_active_regs_')) {
        if (!Array.isArray(value)) {
            return { valid: false, message: '지역명은 배열이어야 합니다' };
        }
        if (context?.validRegions) {
            const invalid = value.filter(r => !context.validRegions.has(r));
            if (invalid.length > 0) {
                return {
                    valid: false,
                    message: `존재하지 않는 지역: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '...' : ''}`,
                    invalidItems: invalid,
                    canAutoClean: true
                };
            }
        }
        return { valid: true };
    }

    return { valid: true };
};

export const validateBackupData = (data, context = {}, options = {}) => {
    const result = createResult();
    result.mode = options.mode || 'soft';

    const structureResult = validateStructure(data);
    result.steps.structure = structureResult;

    if (!structureResult.valid) {
        for (const issue of structureResult.issues) {
            addIssue(result, {
                key: '_structure',
                severity: structureResult.fatal ? SEVERITY.FATAL : SEVERITY.ERROR,
                message: issue
            });
        }

        if (structureResult.fatal) {
            return result;
        }
    }

    const versionResult = validateVersion(data);
    result.steps.version = versionResult;

    if (versionResult.legacy || versionResult.futureVersion) {
        addIssue(result, {
            key: '_version',
            severity: SEVERITY.INFO,
            message: versionResult.message
        });
    }

    const completedResult = validateCompletedMarkers(data.completedMarkers, context);
    result.steps.completed = completedResult;

    if (!completedResult.skip && !completedResult.valid) {
        const errorRate = completedResult.invalidCount /
            (completedResult.validCount + completedResult.invalidCount);

        const severity = (options.mode === 'strict' || errorRate > 0.1)
            ? SEVERITY.ERROR
            : SEVERITY.WARNING;

        for (const issue of completedResult.issues) {
            addIssue(result, {
                key: 'completedMarkers',
                severity,
                message: issue
            });
        }

        if (severity === SEVERITY.ERROR) {
            result.canRestore = false;
        }
    }

    const favoritesResult = validateFavorites(data.favorites, context);
    result.steps.favorites = favoritesResult;

    if (!favoritesResult.skip && !favoritesResult.valid) {
        addIssue(result, {
            key: 'favorites',
            severity: SEVERITY.WARNING,
            message: `${favoritesResult.invalidCount}개 유효하지 않은 항목`
        });
    }

    if (data.settings) {
        const settingsResult = validateSettings(data.settings, context, options);
        result.steps.settings = settingsResult;

        for (const issue of settingsResult.issues) {
            const severity = options.mode === 'strict' ? SEVERITY.ERROR : SEVERITY.WARNING;
            addIssue(result, {
                key: `settings.${issue.key}`,
                severity,
                message: issue.message,
                canAutoClean: issue.canAutoClean
            });

            if (severity === SEVERITY.ERROR) {
                result.canRestore = false;
            }
        }

        for (const cleaned of settingsResult.cleaned) {
            addCleaned(result, cleaned);
        }
    }

    result.summary.passed = result.summary.total - result.summary.failed - result.summary.warnings;

    return result;
};

export { SEVERITY, STATUS };
