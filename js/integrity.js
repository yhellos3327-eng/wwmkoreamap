import { state } from './state.js';

const CHECK_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

const ICONS = {
    pending: "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3C/svg%3E",
    active: "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E",
    success: "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E",
    warning: "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E",
    error: "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='15' y1='9' x2='9' y2='15'/%3E%3Cline x1='9' y1='9' x2='15' y2='15'/%3E%3C/svg%3E"
};

let currentCheckData = null;
let onProceedCallback = null;

const showModal = () => {
    const modal = document.getElementById('integrity-check-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

const hideModal = () => {
    const modal = document.getElementById('integrity-check-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    resetModal();
};

const resetModal = () => {
    const steps = document.querySelectorAll('#integrity-steps .step');
    steps.forEach(step => {
        step.className = 'step';
        const icon = step.querySelector('.step-icon');
        if (icon) {
            icon.className = 'step-icon pending';
            const maskEl = icon.querySelector('.icon-mask');
            if (maskEl) {
                maskEl.style.setProperty('--mask-url', `url("${ICONS.pending}")`);
            }
        }
        const status = step.querySelector('.step-status');
        if (status) status.textContent = '';
    });

    const result = document.getElementById('integrity-result');
    if (result) result.classList.add('hidden');

    const proceedBtn = document.getElementById('integrity-proceed-btn');
    if (proceedBtn) proceedBtn.disabled = true;

    const statusEl = document.getElementById('integrity-status');
    if (statusEl) {
        statusEl.classList.remove('complete');
        statusEl.querySelector('.status-text').textContent = '검사 준비 중...';
    }

    const consoleLog = document.getElementById('integrity-console-log');
    if (consoleLog) {
        consoleLog.innerHTML = '<div class="console-line">> 검사 모듈 초기화 중...</div>';
    }
};

const updateStep = (stepName, status, statusText = '') => {
    const step = document.querySelector(`#integrity-steps .step[data-step="${stepName}"]`);
    if (!step) return;

    step.className = `step ${status}`;

    const icon = step.querySelector('.step-icon');
    if (icon) {
        icon.className = `step-icon ${status}`;
        const maskEl = icon.querySelector('.icon-mask');
        if (maskEl) {
            maskEl.style.setProperty('--mask-url', `url("${ICONS[status] || ICONS.pending}")`);
        }
    }

    const statusEl = step.querySelector('.step-status');
    if (statusEl) statusEl.textContent = statusText;
};

const updateStatus = (text, complete = false) => {
    const statusEl = document.getElementById('integrity-status');
    if (statusEl) {
        statusEl.classList.toggle('complete', complete);
        statusEl.querySelector('.status-text').textContent = text;
    }
};

const showResult = (type, title, desc, details = '') => {
    const result = document.getElementById('integrity-result');
    if (!result) return;

    result.classList.remove('hidden');

    const iconEl = result.querySelector('.result-icon');
    if (iconEl) {
        iconEl.className = `result-icon ${type}`;
        const maskEl = iconEl.querySelector('.icon-mask');
        if (maskEl) {
            maskEl.style.setProperty('--mask-url', `url("${ICONS[type]}")`);
        }
    }

    const titleEl = result.querySelector('.result-title');
    if (titleEl) titleEl.textContent = title;

    const descEl = document.getElementById('result-desc');
    if (descEl) descEl.textContent = desc;

    const detailsEl = document.getElementById('result-details');
    if (detailsEl) detailsEl.innerHTML = details;
};

const consoleLog = (message, type = '') => {
    const consoleEl = document.getElementById('integrity-console-log');
    if (!consoleEl) return;

    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = message;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const checkStructure = (data) => {
    const issues = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, issues: ['데이터가 유효한 객체가 아닙니다.'] };
    }

    if (data.completedMarkers !== undefined) {
        if (!Array.isArray(data.completedMarkers)) {
            issues.push('completedMarkers가 배열이 아닙니다.');
        }
    }

    if (data.favorites !== undefined) {
        if (!Array.isArray(data.favorites)) {
            issues.push('favorites가 배열이 아닙니다.');
        }
    }

    if (data.settings !== undefined) {
        if (typeof data.settings !== 'object' || data.settings === null) {
            issues.push('settings가 유효한 객체가 아닙니다.');
        }
    }

    return { valid: issues.length === 0, issues };
};

const checkCompletedMarkersAsync = async (markers) => {
    if (!markers || !Array.isArray(markers)) {
        consoleLog('  - 완료 목록이 없거나 배열이 아님', 'warning');
        return { valid: true, count: 0, issues: [] };
    }

    const issues = [];
    let validCount = 0;
    let invalidCount = 0;
    const total = markers.length;
    const hasMarkerData = cachedAllData && cachedAllData.allMarkerIds && cachedAllData.allMarkerIds.size > 0;

    if (!hasMarkerData) {
        consoleLog('  ⚠ 마커 데이터가 로드되지 않아 실존 여부 검사를 건너뜁니다.', 'warning');
    }

    consoleLog(`  - 총 ${total}개 항목 검사 시작...`);

    for (let i = 0; i < markers.length; i++) {
        const marker = markers[i];
        let isValid = false;
        let markerId = '(unknown)';
        let errorMsg = '';

        if (typeof marker === 'object' && marker !== null) {
            if (marker.id !== undefined) {
                markerId = marker.id;
                if (typeof markerId === 'number' || (typeof markerId === 'string' && /^\d+$/.test(markerId))) {
                    if (hasMarkerData) {
                        if (cachedAllData.allMarkerIds.has(String(markerId))) {
                            isValid = true;
                        } else {
                            isValid = false;
                            errorMsg = '존재하지 않는 마커 ID';
                        }
                    } else {
                        isValid = true;
                    }
                } else {
                    isValid = false;
                    errorMsg = 'ID가 유효한 숫자가 아님';
                }
            } else {
                isValid = false;
                errorMsg = 'id 누락';
            }
        } else if (typeof marker === 'number' || (typeof marker === 'string' && /^\d+$/.test(marker))) {
            markerId = marker;
            if (hasMarkerData) {
                if (cachedAllData.allMarkerIds.has(String(markerId))) {
                    isValid = true;
                } else {
                    isValid = false;
                    errorMsg = '존재하지 않는 마커 ID';
                }
            } else {
                isValid = true;
            }
        } else {
            isValid = false;
            errorMsg = '잘못된 형식';
        }

        if (isValid) {
            validCount++;
        } else {
            invalidCount++;
            if (issues.length < 3) {
                issues.push(`항목 ${i + 1} (ID: ${markerId}): ${errorMsg}`);
            }
        }

        if (i < 5 || i >= total - 3 || i % 50 === 0) {
            const status = isValid ? '✓' : '✗';
            const statusClass = isValid ? 'success' : 'error';
            const msg = isValid ? '' : ` (${errorMsg})`;
            consoleLog(`    [${String(i + 1).padStart(4, '0')}] ID: ${markerId} ${status}${msg}`, statusClass);
        } else if (i === 5) {
            consoleLog(`    ... (${total - 8}개 항목 검사 중)`, 'info');
        }

        if (i % 20 === 0) await delay(10);
    }

    consoleLog(`  - 검사 완료: 유효 ${validCount}개 / 무효 ${invalidCount}개`);

    if (invalidCount > 3) {
        issues.push(`... 외 ${invalidCount - 3}개 추가 오류`);
    }

    return {
        valid: invalidCount === 0,
        count: validCount,
        invalidCount,
        issues
    };
};

const checkFavoritesAsync = async (favorites) => {
    if (!favorites || !Array.isArray(favorites)) {
        consoleLog('  - 즐겨찾기가 없거나 배열이 아님', 'info');
        return { valid: true, count: 0, issues: [] };
    }

    const issues = [];
    let validCount = 0;
    const total = favorites.length;
    const hasMarkerData = cachedAllData && cachedAllData.allMarkerIds && cachedAllData.allMarkerIds.size > 0;

    consoleLog(`  - 총 ${total}개 항목 검사 시작...`);

    for (let i = 0; i < favorites.length; i++) {
        const fav = favorites[i];
        let isValid = false;
        let favId = '(unknown)';
        let errorMsg = '';
        if (typeof fav === 'number' || (typeof fav === 'string' && /^\d+$/.test(fav))) {
            favId = fav;
        } else if (typeof fav === 'object' && fav !== null && fav.id !== undefined) {
            favId = fav.id;
        } else {
            favId = null;
        }

        if (favId !== null) {
            if (typeof favId === 'number' || (typeof favId === 'string' && /^\d+$/.test(favId))) {
                if (hasMarkerData) {
                    if (cachedAllData.allMarkerIds.has(String(favId))) {
                        isValid = true;
                    } else {
                        isValid = false;
                        errorMsg = '존재하지 않는 마커 ID';
                    }
                } else {
                    isValid = true;
                }
            } else {
                isValid = false;
                errorMsg = 'ID가 유효한 숫자가 아님';
            }
        } else {
            isValid = false;
            errorMsg = '잘못된 형식';
        }

        if (isValid) {
            validCount++;
        } else {
            if (issues.length < 3) {
                issues.push(`항목 ${i + 1}: ${errorMsg}`);
            }
        }

        const status = isValid ? '✓' : '✗';
        const statusClass = isValid ? 'success' : 'error';
        const msg = isValid ? '' : ` (${errorMsg})`;
        consoleLog(`    [${String(i + 1).padStart(2, '0')}] ID: ${favId} ${status}${msg}`, statusClass);

        await delay(30);
    }

    consoleLog(`  - 검사 완료: ${validCount}개 유효`);

    return { valid: issues.length === 0, count: validCount, issues };
};

const checkSettingsAsync = async (settings) => {
    if (!settings || typeof settings !== 'object') {
        consoleLog('  - 설정 데이터 없음', 'info');
        return { valid: true, count: 0, issues: [] };
    }

    const issues = [];
    const keys = Object.keys(settings).filter(k => k !== '_updatedAt');
    let invalidCount = 0;
    const hasRegionData = cachedAllData && cachedAllData.allRegionNames && cachedAllData.allRegionNames.size > 0;

    consoleLog(`  - 총 ${keys.length}개 설정 항목 정밀 검사...`);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = settings[key];
        let isValid = true;
        let msg = '';
        if (key.startsWith('activeCats')) {
            if (!Array.isArray(value)) {
                isValid = false;
                msg = '배열 형식이 아님';
            } else {
                const invalidItems = value.filter(item => {
                    return typeof item !== 'string' || !/^\d+$/.test(item);
                });

                if (invalidItems.length > 0) {
                    isValid = false;
                    msg = `유효하지 않은 ID 포함 (${invalidItems[0]} 등 ${invalidItems.length}개)`;
                }
            }
        } else if (key.startsWith('activeRegs')) {
            if (!Array.isArray(value)) {
                isValid = false;
                msg = '배열 형식이 아님';
            } else if (hasRegionData) {
                const invalidRegions = value.filter(regionName => {
                    return typeof regionName !== 'string' || !cachedAllData.allRegionNames.has(regionName);
                });

                if (invalidRegions.length > 0) {
                    isValid = false;
                    msg = `존재하지 않는 지역 포함: ${invalidRegions.join(', ')}`;
                }
            }
        } else if (key === 'wwm_cleanup_last_run' || key.includes('last_run')) {
            if (typeof value !== 'number' || isNaN(value)) {
                isValid = false;
                msg = '유효한 숫자가 아님';
            }
        } else if (key === 'showAd' || key === 'showComments' || key === 'hideCompleted' || key === 'enableClustering' || key === 'closeOnComplete') {
            if (typeof value !== 'boolean') {
                isValid = false;
                msg = '불리언(true/false) 값이 아님';
            }
        }

        const displayValue = typeof value === 'object' ? JSON.stringify(value).slice(0, 30) + '...' : String(value).slice(0, 20);

        if (isValid) {
            consoleLog(`    [${key}]: ${displayValue} ✓`, 'success');
        } else {
            consoleLog(`    [${key}]: ${displayValue} ✗ (${msg})`, 'error');
            issues.push(`설정 [${key}]: ${msg}`);
            invalidCount++;
        }
        await delay(20);
    }

    if (invalidCount > 0) {
        consoleLog(`  - 검사 완료: ${invalidCount}개 항목 오류 발견`, 'error');
        return { valid: false, count: keys.length, issues };
    }

    consoleLog(`  - 검사 완료: ${keys.length}개 항목 정상`);
    return { valid: true, count: keys.length, issues };
};

let cachedAllData = null;

const fetchAllData = async () => {
    if (cachedAllData) return cachedAllData;

    const allMarkerIds = new Set();
    const allRegionNames = new Set();

    consoleLog('> 전체 데이터 파일 로드 중...', 'info');

    try {
        const jsonFiles = ['./data.json', './data2.json'];
        for (const file of jsonFiles) {
            try {
                const res = await fetch(file);
                if (res.ok) {
                    const json = await res.json();
                    let count = 0;
                    if (json.data && Array.isArray(json.data)) {
                        json.data.forEach(item => {
                            if (item.id) {
                                allMarkerIds.add(String(item.id));
                                count++;
                            }
                        });
                    }
                    consoleLog(`  - ${file}: 마커 ${count}개 로드`, 'info');
                }
            } catch (e) {
                console.warn(`Failed to load ${file}:`, e);
            }
        }

        const csvFiles = ['./data3.csv', './data4.csv'];
        for (const file of csvFiles) {
            try {
                const res = await fetch(file);
                if (res.ok) {
                    const text = await res.text();
                    const lines = text.split('\n');
                    let markerCount = 0;
                    let regionCount = 0;

                    const headers = lines[0] ? lines[0].split(',').map(h => h.trim().toLowerCase()) : [];
                    const regionIdIndex = headers.findIndex(h => h === 'regionid');

                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line) {
                            const parts = line.split(',');
                            if (parts.length > 0 && parts[0]) {
                                const id = parts[0].trim();
                                if (/^\d+$/.test(id)) {
                                    allMarkerIds.add(id);
                                    markerCount++;
                                }

                                if (regionIdIndex !== -1 && parts[regionIdIndex]) {
                                    const regionName = parts[regionIdIndex].trim();
                                    if (regionName && !allRegionNames.has(regionName)) {
                                        allRegionNames.add(regionName);
                                        regionCount++;
                                    }
                                }
                            }
                        }
                    }
                    consoleLog(`  - ${file}: 마커 ${markerCount}개, 지역 ${regionCount}개 로드`, 'info');
                }
            } catch (e) {
                console.warn(`Failed to load ${file}:`, e);
            }
        }

        const regionFiles = ['./regions.json', './regions2.json'];
        for (const file of regionFiles) {
            try {
                const res = await fetch(file);
                if (res.ok) {
                    const json = await res.json();
                    let count = 0;
                    if (json.data && Array.isArray(json.data)) {
                        json.data.forEach(item => {
                            if (item.title) {
                                allRegionNames.add(item.title);
                                count++;
                            }
                        });
                    }
                    consoleLog(`  - ${file}: 지역 ${count}개 로드`, 'info');
                }
            } catch (e) {
                console.warn(`Failed to load ${file}:`, e);
            }
        }

        allRegionNames.add('알 수 없음');

        const translationFiles = ['./translation.csv', './translation2.csv'];
        for (const file of translationFiles) {
            try {
                const res = await fetch(file);
                if (res.ok) {
                    const text = await res.text();
                    const lines = text.split('\n');
                    let regionCount = 0;

                    const headers = lines[0] ? lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase()) : [];
                    const koreanIndex = headers.findIndex(h => h === 'korean');
                    const regionIndex = headers.findIndex(h => h === 'region');

                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        const parts = [];
                        let current = '';
                        let inQuotes = false;
                        for (let j = 0; j < line.length; j++) {
                            const char = line[j];
                            if (char === '"') {
                                inQuotes = !inQuotes;
                            } else if (char === ',' && !inQuotes) {
                                parts.push(current.trim().replace(/^"|"$/g, ''));
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        parts.push(current.trim().replace(/^"|"$/g, ''));
                        if (parts[0] === 'Common' && koreanIndex !== -1 && parts[koreanIndex]) {
                            const koreanName = parts[koreanIndex];
                            if (koreanName && !allRegionNames.has(koreanName)) {
                                allRegionNames.add(koreanName);
                                regionCount++;
                            }
                        }

                        if (regionIndex !== -1 && parts[regionIndex]) {
                            const regionName = parts[regionIndex];
                            if (regionName && !allRegionNames.has(regionName)) {
                                allRegionNames.add(regionName);
                                regionCount++;
                            }
                        }
                    }
                    if (regionCount > 0) {
                        consoleLog(`  - ${file}: 번역 지역 ${regionCount}개 로드`, 'info');
                    }
                }
            } catch (e) {
                console.warn(`Failed to load translation file ${file}:`, e);
            }
        }

        consoleLog(`> 데이터 로드 완료: 총 마커 ${allMarkerIds.size}개, 총 지역 ${allRegionNames.size}개`, 'success');
        cachedAllData = { allMarkerIds, allRegionNames };
        return cachedAllData;

    } catch (error) {
        console.error('Error fetching all data:', error);
        return { allMarkerIds: new Set(), allRegionNames: new Set() };
    }
};

export const runIntegrityCheck = async (data, onProceed) => {
    currentCheckData = data;
    onProceedCallback = onProceed;

    showModal();
    resetModal();

    consoleLog('> 데이터 무결성 검사 시작', 'highlight');
    consoleLog(`> 검사 시간: ${new Date().toLocaleTimeString('ko-KR')}`, 'info');

    await fetchAllData();

    const results = {
        structure: null,
        completed: null,
        favorites: null,
        settings: null
    };

    let hasError = false;
    let hasWarning = false;

    await delay(300);
    consoleLog('');
    consoleLog('> [STEP 1/4] JSON 구조 검사 시작...', 'info');
    updateStatus('JSON 구조 검사 중...');
    updateStep('structure', CHECK_STATUS.ACTIVE);

    consoleLog('  - typeof data: ' + typeof data);
    consoleLog('  - data !== null: ' + (data !== null));

    await delay(300);
    results.structure = checkStructure(data);

    if (data) {
        consoleLog('  - completedMarkers 존재: ' + (data.completedMarkers !== undefined));
        consoleLog('  - favorites 존재: ' + (data.favorites !== undefined));
        consoleLog('  - settings 존재: ' + (data.settings !== undefined));
    }

    await delay(200);
    if (!results.structure.valid) {
        consoleLog('  ✗ 구조 검사 실패', 'error');
        results.structure.issues.forEach(issue => {
            consoleLog('    - ' + issue, 'error');
        });
        updateStep('structure', CHECK_STATUS.ERROR, '실패');
        hasError = true;
    } else {
        consoleLog('  ✓ 구조 검사 통과', 'success');
        updateStep('structure', CHECK_STATUS.SUCCESS, '정상');
    }

    if (hasError) {
        consoleLog('');
        consoleLog('> 검사 중단: 심각한 오류 발견', 'error');
        updateStatus('검사 완료 - 오류 발견', true);
        showResult('error', '구조 오류', '데이터 형식이 올바르지 않습니다.',
            results.structure.issues.map(i => `• ${i}`).join('<br>'));
        return;
    }

    await delay(200);
    consoleLog('');
    consoleLog('> [STEP 2/4] 완료 목록 검증 중...', 'info');
    updateStatus('완료 목록 검증 중...');
    updateStep('completed', CHECK_STATUS.ACTIVE);

    results.completed = await checkCompletedMarkersAsync(data.completedMarkers);

    await delay(100);
    if (!results.completed.valid) {
        if (results.completed.invalidCount > results.completed.count * 0.1) {
            consoleLog('  ✗ 완료 목록 검사 실패 (오류율 10% 초과)', 'error');
            updateStep('completed', CHECK_STATUS.ERROR, `${results.completed.invalidCount}개 오류`);
            hasError = true;
        } else {
            consoleLog('  ⚠ 완료 목록 검사 경고', 'warning');
            updateStep('completed', CHECK_STATUS.WARNING, `${results.completed.count}개 (${results.completed.invalidCount}개 경고)`);
            hasWarning = true;
        }
    } else {
        consoleLog('  ✓ 완료 목록 검사 통과', 'success');
        updateStep('completed', CHECK_STATUS.SUCCESS, `${results.completed.count}개`);
    }

    await delay(200);
    consoleLog('');
    consoleLog('> [STEP 3/4] 즐겨찾기 검증 중...', 'info');
    updateStatus('즐겨찾기 검증 중...');
    updateStep('favorites', CHECK_STATUS.ACTIVE);

    results.favorites = await checkFavoritesAsync(data.favorites);

    await delay(100);
    if (!results.favorites.valid) {
        consoleLog('  ⚠ 즐겨찾기 검사 경고', 'warning');
        updateStep('favorites', CHECK_STATUS.WARNING, `${results.favorites.count}개 (경고)`);
        hasWarning = true;
    } else {
        consoleLog('  ✓ 즐겨찾기 검사 통과', 'success');
        updateStep('favorites', CHECK_STATUS.SUCCESS, `${results.favorites.count}개`);
    }

    await delay(200);
    consoleLog('');
    consoleLog('> [STEP 4/4] 설정 데이터 검증 중...', 'info');
    updateStatus('설정 데이터 검증 중...');
    updateStep('settings', CHECK_STATUS.ACTIVE);

    results.settings = await checkSettingsAsync(data.settings);

    if (!results.settings.valid) {
        consoleLog('  ✗ 설정 검사 실패', 'error');
        updateStep('settings', CHECK_STATUS.ERROR, `${results.settings.issues.length}개 오류`);
        hasError = true;
    } else {
        consoleLog('  ✓ 설정 검사 통과', 'success');
        updateStep('settings', CHECK_STATUS.SUCCESS, `${results.settings.count}개 항목`);
    }

    await delay(300);
    consoleLog('');
    consoleLog('━'.repeat(40), 'info');

    if (hasError) {
        consoleLog('> 최종 결과: 복원 불가', 'error');
        consoleLog('> 심각한 오류가 발견되었습니다.', 'error');
        updateStatus('검사 완료 - 오류 발견', true);
        showResult('error', '복원 불가',
            '데이터에 심각한 오류가 있어 복원할 수 없습니다.',
            [...results.structure.issues, ...results.completed.issues, ...results.settings.issues].map(i => `• ${i}`).join('<br>'));
    } else if (hasWarning) {
        consoleLog('> 최종 결과: 경고와 함께 복원 가능', 'warning');
        consoleLog('> 일부 데이터에 문제가 있을 수 있습니다.', 'warning');
        updateStatus('검사 완료 - 경고 있음', true);
        showResult('warning', '경고와 함께 복원 가능',
            `완료 ${results.completed.count}개, 즐겨찾기 ${results.favorites.count}개`,
            '일부 데이터에 문제가 있을 수 있지만 복원은 가능합니다.');

        const proceedBtn = document.getElementById('integrity-proceed-btn');
        if (proceedBtn) proceedBtn.disabled = false;
    } else {
        consoleLog('> 최종 결과: 모든 검사 통과 ✓', 'success');
        consoleLog('> 데이터 무결성 확인 완료', 'success');
        updateStatus('검사 완료 - 이상 없음', true);
        showResult('success', '검사 통과',
            `완료 ${results.completed.count}개, 즐겨찾기 ${results.favorites.count}개`,
            '모든 데이터가 정상입니다. 안전하게 복원할 수 있습니다.');

        const proceedBtn = document.getElementById('integrity-proceed-btn');
        if (proceedBtn) proceedBtn.disabled = false;
    }

    consoleLog('> 검사 종료: ' + new Date().toLocaleTimeString('ko-KR'), 'info');
};

export const initIntegrityModal = () => {
    const cancelBtn = document.getElementById('integrity-cancel-btn');
    const proceedBtn = document.getElementById('integrity-proceed-btn');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideModal);
    }

    if (proceedBtn) {
        proceedBtn.addEventListener('click', () => {
            if (onProceedCallback && currentCheckData) {
                hideModal();
                onProceedCallback(currentCheckData);
            }
        });
    }
};

export const closeIntegrityModal = hideModal;

const ALERT_ICONS = {
    success: `<div class="icon-mask" style="width: 32px; height: 32px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E&quot;);"></div>`,
    error: `<div class="icon-mask" style="width: 32px; height: 32px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='15' y1='9' x2='9' y2='15'/%3E%3Cline x1='9' y1='9' x2='15' y2='15'/%3E%3C/svg%3E&quot;);"></div>`,
    warning: `<div class="icon-mask" style="width: 32px; height: 32px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E&quot;);"></div>`,
    info: `<div class="icon-mask" style="width: 32px; height: 32px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='16' x2='12' y2='12'/%3E%3Cline x1='12' y1='8' x2='12.01' y2='8'/%3E%3C/svg%3E&quot;);"></div>`
};

let alertResolve = null;

export const showResultAlert = (type, title, message, autoReload = false) => {
    return new Promise((resolve) => {
        alertResolve = resolve;

        const modal = document.getElementById('result-alert-modal');
        const iconEl = document.getElementById('result-alert-icon');
        const titleEl = document.getElementById('result-alert-title');
        const messageEl = document.getElementById('result-alert-message');
        const confirmBtn = document.getElementById('result-alert-confirm');

        if (!modal) {
            alert(`${title}\n\n${message}`);
            if (autoReload) location.reload();
            resolve();
            return;
        }
        if (iconEl) {
            iconEl.className = `result-alert-icon ${type}`;
            iconEl.innerHTML = ALERT_ICONS[type] || ALERT_ICONS.info;
        }
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (confirmBtn) {
            const newBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

            newBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                if (autoReload) {
                    location.reload();
                }
                resolve();
            });
        }

        modal.classList.remove('hidden');
    });
};

export const initResultAlertModal = () => {
    const modal = document.getElementById('result-alert-modal');
    if (!modal) return;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            if (alertResolve) {
                alertResolve();
                alertResolve = null;
            }
        }
    });
};
