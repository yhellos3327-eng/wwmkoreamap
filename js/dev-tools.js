/**
 * 개발자 도구 모듈
 * 콘솔에서 dev() 로 활성화
 */

import { state } from './state.js';

// 개발자 도구 상태
const devState = {
    isActive: false,
    currentMode: null, // 'move', 'coords', 'inspect'
    selectedMarker: null,
    selectedMarkerData: null,
    changes: new Map(), // id -> { original: {lat, lng}, modified: {lat, lng} }
    originalPositions: new Map() // 백업용
};

// 스타일 정의
const HIGHLIGHT_STYLE = 'filter: drop-shadow(0 0 8px #00ff00) drop-shadow(0 0 16px #00ff00); transform: scale(1.3);';

/**
 * 개발자 도구 모달 생성
 */
const createDevModal = () => {
    // 이미 존재하면 반환
    if (document.getElementById('dev-tools-modal')) {
        return document.getElementById('dev-tools-modal');
    }

    const modal = document.createElement('div');
    modal.id = 'dev-tools-modal';
    modal.className = 'dev-tools-panel';
    modal.innerHTML = `
        <div class="dev-tools-header">
            <span class="dev-tools-title">🔧 개발자 도구</span>
            <button class="dev-tools-close" id="dev-close-btn">×</button>
        </div>
        <div class="dev-tools-body">
            <div class="dev-tools-status">
                <div class="dev-status-label">현재 모드</div>
                <div class="dev-status-value" id="dev-current-mode">없음</div>
            </div>
            
            <div class="dev-tools-buttons">
                <button class="dev-btn" id="dev-btn-move" title="마커 클릭 후 새 위치 클릭">
                    <span class="dev-btn-icon">📍</span>
                    <span class="dev-btn-text">마커 위치 수정</span>
                </button>
                <button class="dev-btn" id="dev-btn-coords" title="맵 클릭시 좌표 복사">
                    <span class="dev-btn-icon">📋</span>
                    <span class="dev-btn-text">좌표 복사 모드</span>
                </button>
                <button class="dev-btn" id="dev-btn-inspect" title="마커 클릭시 정보 출력">
                    <span class="dev-btn-icon">🔍</span>
                    <span class="dev-btn-text">마커 정보 보기</span>
                </button>
            </div>
            
            <div class="dev-tools-divider"></div>
            
            <div class="dev-tools-info">
                <div class="dev-info-row">
                    <span class="dev-info-label">변경된 마커</span>
                    <span class="dev-info-value" id="dev-change-count">0개</span>
                </div>
                <div class="dev-info-row" id="dev-selected-info" style="display: none;">
                    <span class="dev-info-label">선택된 마커</span>
                    <span class="dev-info-value" id="dev-selected-name">-</span>
                </div>
                <div class="dev-info-row">
                    <span class="dev-info-label">마우스 좌표</span>
                    <span class="dev-info-value" id="dev-mouse-coords">-</span>
                </div>
            </div>
            
            <div class="dev-tools-divider"></div>
            
            <div class="dev-tools-actions">
                <button class="dev-action-btn dev-action-export" id="dev-btn-export">
                    💾 변경사항 내보내기
                </button>
                <button class="dev-action-btn dev-action-reset" id="dev-btn-reset">
                    ↩️ 모두 초기화
                </button>
            </div>
        </div>
        
        <div class="dev-tools-log" id="dev-log">
            <div class="dev-log-title">📝 로그</div>
            <div class="dev-log-content" id="dev-log-content"></div>
        </div>
    `;

    document.body.appendChild(modal);
    addDevStyles();
    bindDevEvents();

    return modal;
};

/**
 * CSS 스타일 추가
 */
const addDevStyles = () => {
    if (document.getElementById('dev-tools-styles')) return;

    const style = document.createElement('style');
    style.id = 'dev-tools-styles';
    style.textContent = `
        .dev-tools-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 280px;
            background: rgba(20, 20, 25, 0.95);
            border: 1px solid #444;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            z-index: 9999;
            font-family: 'Segoe UI', sans-serif;
            color: #fff;
            backdrop-filter: blur(10px);
            overflow: hidden;
            transition: all 0.3s ease;
        }
        
        .dev-tools-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: rgba(218, 172, 113, 0.15);
            border-bottom: 1px solid #333;
        }
        
        .dev-tools-title {
            font-weight: 700;
            font-size: 14px;
            color: #daac71;
        }
        
        .dev-tools-close {
            background: transparent;
            border: none;
            color: #888;
            font-size: 20px;
            cursor: pointer;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s;
        }
        
        .dev-tools-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }
        
        .dev-tools-body {
            padding: 16px;
        }
        
        .dev-tools-status {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            text-align: center;
        }
        
        .dev-status-label {
            font-size: 11px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
        }
        
        .dev-status-value {
            font-size: 16px;
            font-weight: 600;
            color: #daac71;
        }
        
        .dev-tools-buttons {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .dev-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid #333;
            border-radius: 8px;
            color: #ddd;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 13px;
        }
        
        .dev-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: #555;
        }
        
        .dev-btn.active {
            background: rgba(218, 172, 113, 0.2);
            border-color: #daac71;
            color: #daac71;
        }
        
        .dev-btn-icon {
            font-size: 18px;
        }
        
        .dev-btn-text {
            font-weight: 500;
        }
        
        .dev-tools-divider {
            height: 1px;
            background: #333;
            margin: 16px 0;
        }
        
        .dev-tools-info {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .dev-info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }
        
        .dev-info-label {
            color: #888;
        }
        
        .dev-info-value {
            color: #ddd;
            font-weight: 500;
            font-family: monospace;
        }
        
        .dev-tools-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .dev-action-btn {
            padding: 10px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s;
        }
        
        .dev-action-export {
            background: linear-gradient(135deg, #4a9eff, #0066cc);
            color: #fff;
        }
        
        .dev-action-export:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(74, 158, 255, 0.4);
        }
        
        .dev-action-reset {
            background: rgba(255, 100, 100, 0.15);
            color: #ff6b6b;
            border: 1px solid rgba(255, 100, 100, 0.3);
        }
        
        .dev-action-reset:hover {
            background: rgba(255, 100, 100, 0.25);
        }
        
        .dev-tools-log {
            border-top: 1px solid #333;
            max-height: 150px;
            overflow: hidden;
        }
        
        .dev-log-title {
            font-size: 11px;
            color: #888;
            padding: 8px 16px;
            background: rgba(0, 0, 0, 0.2);
        }
        
        .dev-log-content {
            padding: 8px 16px;
            max-height: 110px;
            overflow-y: auto;
            font-size: 11px;
            font-family: monospace;
            color: #aaa;
        }
        
        .dev-log-entry {
            padding: 4px 0;
            border-bottom: 1px solid #222;
        }
        
        .dev-log-entry:last-child {
            border-bottom: none;
        }
        
        .dev-log-time {
            color: #666;
            margin-right: 8px;
        }
        
        .dev-log-success { color: #4ade80; }
        .dev-log-info { color: #60a5fa; }
        .dev-log-warn { color: #fbbf24; }
        
        /* 선택된 마커 하이라이트 */
        .dev-selected-marker {
            filter: drop-shadow(0 0 8px #00ff00) drop-shadow(0 0 16px #00ff00) !important;
            transform: scale(1.3) !important;
            z-index: 10000 !important;
        }
        
        /* 수정된 마커 표시 */
        .dev-modified-marker {
            filter: drop-shadow(0 0 6px #ff9500) !important;
        }
    `;
    document.head.appendChild(style);
};

/**
 * 로그 출력
 */
const addLog = (message, type = 'info') => {
    const logContent = document.getElementById('dev-log-content');
    if (!logContent) return;

    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.className = `dev-log-entry dev-log-${type}`;
    entry.innerHTML = `<span class="dev-log-time">${time}</span>${message}`;

    logContent.insertBefore(entry, logContent.firstChild);

    // 최대 20개 로그 유지
    while (logContent.children.length > 20) {
        logContent.removeChild(logContent.lastChild);
    }
};

/**
 * UI 업데이트
 */
const updateUI = () => {
    // 현재 모드 표시
    const modeDisplay = document.getElementById('dev-current-mode');
    if (modeDisplay) {
        const modeNames = {
            'move': '📍 마커 이동',
            'coords': '📋 좌표 복사',
            'inspect': '🔍 정보 보기'
        };
        modeDisplay.textContent = devState.currentMode ? modeNames[devState.currentMode] : '없음';
    }

    // 변경 개수
    const changeCount = document.getElementById('dev-change-count');
    if (changeCount) {
        changeCount.textContent = `${devState.changes.size}개`;
    }

    // 버튼 active 상태
    ['move', 'coords', 'inspect'].forEach(mode => {
        const btn = document.getElementById(`dev-btn-${mode}`);
        if (btn) {
            btn.classList.toggle('active', devState.currentMode === mode);
        }
    });

    // 선택된 마커 정보
    const selectedInfo = document.getElementById('dev-selected-info');
    const selectedName = document.getElementById('dev-selected-name');
    if (selectedInfo && selectedName) {
        if (devState.selectedMarkerData) {
            selectedInfo.style.display = 'flex';
            selectedName.textContent = devState.selectedMarkerData.originalName || devState.selectedMarkerData.id;
        } else {
            selectedInfo.style.display = 'none';
        }
    }
};

/**
 * 모드 설정
 */
const setMode = (mode) => {
    // 같은 모드 클릭시 해제
    if (devState.currentMode === mode) {
        devState.currentMode = null;
        clearSelection();
        addLog(`모드 해제`, 'info');
    } else {
        devState.currentMode = mode;
        clearSelection();
        const modeMessages = {
            'move': '마커를 클릭하세요',
            'coords': '맵을 클릭하면 좌표가 복사됩니다',
            'inspect': '마커를 클릭하면 정보가 출력됩니다'
        };
        addLog(modeMessages[mode], 'info');
    }
    updateUI();
};

/**
 * 선택 해제
 */
const clearSelection = () => {
    if (devState.selectedMarker) {
        const icon = devState.selectedMarker.getElement?.();
        if (icon) {
            icon.classList.remove('dev-selected-marker');
        }
    }
    devState.selectedMarker = null;
    devState.selectedMarkerData = null;
    updateUI();
};

/**
 * 마커 클릭 핸들러
 */
const handleMarkerClick = (e) => {
    if (!devState.isActive || !devState.currentMode) return;

    const marker = e.target;
    const markerData = Array.from(state.allMarkers.values()).find(m => m.marker === marker);

    if (!markerData) return;

    // 팝업 닫기
    marker.closePopup();

    if (devState.currentMode === 'move') {
        // 이미 선택된 마커가 있으면 해제
        clearSelection();

        // 새 마커 선택
        devState.selectedMarker = marker;
        devState.selectedMarkerData = markerData;

        // 하이라이트
        const icon = marker.getElement?.();
        if (icon) {
            icon.classList.add('dev-selected-marker');
        }

        addLog(`선택: ${markerData.originalName || markerData.id}`, 'info');
        updateUI();

    } else if (devState.currentMode === 'inspect') {
        // 정보 출력
        const info = {
            id: markerData.id,
            name: markerData.originalName,
            category: markerData.category,
            lat: markerData.lat,
            lng: markerData.lng,
            region: markerData.region
        };

        console.log('%c🔍 마커 정보', 'color: #60a5fa; font-size: 14px; font-weight: bold;');
        console.table(info);

        addLog(`정보 출력: ${markerData.originalName || markerData.id}`, 'success');
    }

    e.originalEvent?.stopPropagation();
};

/**
 * 맵 클릭 핸들러
 */
const handleMapClick = (e) => {
    if (!devState.isActive || !devState.currentMode) return;

    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);

    if (devState.currentMode === 'coords') {
        // 좌표 복사
        const coordsText = `${lat}, ${lng}`;
        navigator.clipboard.writeText(coordsText).then(() => {
            addLog(`복사됨: ${coordsText}`, 'success');
        }).catch(() => {
            addLog(`좌표: ${coordsText}`, 'info');
        });

    } else if (devState.currentMode === 'move' && devState.selectedMarker) {
        // 마커 이동
        const markerData = devState.selectedMarkerData;
        const originalLat = markerData.lat;
        const originalLng = markerData.lng;

        // 원본 위치 저장 (처음 이동시에만)
        if (!devState.originalPositions.has(markerData.id)) {
            devState.originalPositions.set(markerData.id, { lat: originalLat, lng: originalLng });
        }

        // 마커 위치 변경
        devState.selectedMarker.setLatLng([parseFloat(lat), parseFloat(lng)]);
        markerData.lat = parseFloat(lat);
        markerData.lng = parseFloat(lng);

        // 변경 기록
        devState.changes.set(markerData.id, {
            id: markerData.id,
            name: markerData.originalName,
            category: markerData.category,
            original: devState.originalPositions.get(markerData.id),
            modified: { lat: parseFloat(lat), lng: parseFloat(lng) }
        });

        // 수정된 마커 표시
        const icon = devState.selectedMarker.getElement?.();
        if (icon) {
            icon.classList.remove('dev-selected-marker');
            icon.classList.add('dev-modified-marker');
        }

        addLog(`이동 완료: ${markerData.originalName || markerData.id}`, 'success');
        console.log(`%c✅ 마커 이동`, 'color: #4ade80; font-weight: bold;', {
            id: markerData.id,
            name: markerData.originalName,
            from: `${originalLat}, ${originalLng}`,
            to: `${lat}, ${lng}`
        });

        clearSelection();
    }
};

/**
 * 마우스 이동 핸들러 (좌표 표시)
 */
const handleMouseMove = (e) => {
    if (!devState.isActive) return;

    const coordsDisplay = document.getElementById('dev-mouse-coords');
    if (coordsDisplay) {
        coordsDisplay.textContent = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
    }
};

/**
 * 변경사항 내보내기
 */
const exportChanges = () => {
    if (devState.changes.size === 0) {
        addLog('변경된 마커가 없습니다', 'warn');
        return;
    }

    const changesArray = Array.from(devState.changes.values());

    // JSON 형식
    const jsonOutput = changesArray.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        latitude: c.modified.lat,
        longitude: c.modified.lng,
        customPosition: `[${c.modified.lat}|${c.modified.lng}]`,
        _original: c.original
    }));

    // CSV 형식 - translation.csv에 붙여넣기용
    const csvLines = changesArray.map(c => {
        const category = c.category || '';
        const id = c.id;
        const name = c.name || '';
        // 형식: Override,"category","id","name","","","","","[x|y]"
        return `Override,"${category}","${id}","${name}","","","","","[${c.modified.lat}|${c.modified.lng}]"`;
    });
    const csvOutput = csvLines.join('\n');

    // 콘솔 출력
    console.log('%c📋 변경된 마커 목록 (JSON)', 'color: #daac71; font-size: 16px; font-weight: bold;');
    console.log(JSON.stringify(jsonOutput, null, 2));

    console.log('%c📋 CSV 형식 (translation.csv에 붙여넣기)', 'color: #4ade80; font-size: 14px; font-weight: bold;');
    console.log(csvOutput);

    // 클립보드 복사 (CSV 형식)
    navigator.clipboard.writeText(csvOutput).then(() => {
        addLog(`${changesArray.length}개 마커 CSV 복사됨`, 'success');
    });

    // JSON 파일 다운로드
    const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marker-changes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * 모든 변경 초기화
 */
const resetAllChanges = () => {
    if (devState.changes.size === 0) {
        addLog('초기화할 변경사항이 없습니다', 'warn');
        return;
    }

    // 원래 위치로 복구
    devState.changes.forEach((change, id) => {
        const markerData = state.allMarkers.get(id);
        if (markerData && markerData.marker) {
            const original = devState.originalPositions.get(id);
            if (original) {
                markerData.marker.setLatLng([original.lat, original.lng]);
                markerData.lat = original.lat;
                markerData.lng = original.lng;

                const icon = markerData.marker.getElement?.();
                if (icon) {
                    icon.classList.remove('dev-modified-marker');
                }
            }
        }
    });

    const count = devState.changes.size;
    devState.changes.clear();
    devState.originalPositions.clear();

    addLog(`${count}개 마커 복원됨`, 'success');
    updateUI();
};

/**
 * 이벤트 바인딩
 */
const bindDevEvents = () => {
    // 닫기 버튼
    document.getElementById('dev-close-btn')?.addEventListener('click', () => {
        stopDev();
    });

    // 모드 버튼들
    document.getElementById('dev-btn-move')?.addEventListener('click', () => setMode('move'));
    document.getElementById('dev-btn-coords')?.addEventListener('click', () => setMode('coords'));
    document.getElementById('dev-btn-inspect')?.addEventListener('click', () => setMode('inspect'));

    // 액션 버튼들
    document.getElementById('dev-btn-export')?.addEventListener('click', exportChanges);
    document.getElementById('dev-btn-reset')?.addEventListener('click', resetAllChanges);

    // ESC 키로 선택 해제
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && devState.isActive) {
            if (devState.selectedMarker) {
                clearSelection();
                addLog('선택 해제됨', 'info');
            } else if (devState.currentMode) {
                setMode(devState.currentMode); // 토글로 해제
            }
        }
    });
};

/**
 * 마커들에 이벤트 연결
 */
const attachMarkerListeners = () => {
    if (!state.allMarkers) return;

    state.allMarkers.forEach((data) => {
        if (data.marker) {
            data.marker.off('click', handleMarkerClick);
            data.marker.on('click', handleMarkerClick);
        }
    });
};

/**
 * 개발자 도구 시작
 */
const startDev = () => {
    if (devState.isActive) {
        console.log('%c🔧 개발자 도구가 이미 활성화되어 있습니다.', 'color: #fbbf24;');
        return;
    }

    devState.isActive = true;

    // 모달 생성 및 표시
    const modal = createDevModal();
    modal.style.display = 'block';

    // 맵 이벤트 연결
    if (state.map) {
        state.map.on('click', handleMapClick);
        state.map.on('mousemove', handleMouseMove);
    }

    // 마커 이벤트 연결
    attachMarkerListeners();

    console.log('%c🔧 개발자 도구가 활성화되었습니다!', 'color: #4ade80; font-size: 16px; font-weight: bold;');
    console.log('%c사용법: 모달에서 모드를 선택하세요.', 'color: #888;');

    addLog('개발자 도구 시작!', 'success');
    updateUI();
};

/**
 * 개발자 도구 종료
 */
const stopDev = () => {
    devState.isActive = false;
    devState.currentMode = null;
    clearSelection();

    // 모달 숨기기
    const modal = document.getElementById('dev-tools-modal');
    if (modal) {
        modal.style.display = 'none';
    }

    // 맵 이벤트 제거
    if (state.map) {
        state.map.off('click', handleMapClick);
        state.map.off('mousemove', handleMouseMove);
    }

    console.log('%c🔧 개발자 도구가 비활성화되었습니다.', 'color: #888;');
};

// 전역 함수로 노출
const dev = () => {
    startDev();
};

dev.stop = stopDev;
dev.export = exportChanges;
dev.reset = resetAllChanges;
dev.changes = () => devState.changes;
dev.help = () => {
    console.log(`
%c🔧 개발자 도구 도움말
%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

%c시작/종료%c
  dev()        - 개발자 도구 열기
  dev.stop()   - 개발자 도구 닫기

%c내보내기%c
  dev.export() - 변경된 마커 JSON 내보내기
  dev.reset()  - 모든 변경 초기화

%c확인%c
  dev.changes() - 현재 변경 목록 확인
  dev.help()    - 이 도움말 표시
    `,
        'color: #daac71; font-size: 16px; font-weight: bold;',
        'color: #444;',
        'color: #4ade80; font-weight: bold;', 'color: #888;',
        'color: #60a5fa; font-weight: bold;', 'color: #888;',
        'color: #fbbf24; font-weight: bold;', 'color: #888;'
    );
};

// window에 노출
window.dev = dev;

export { dev, startDev, stopDev };
