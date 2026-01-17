/**
 * 개발자 도구 모듈
 * 콘솔에서 dev() 로 활성화
 */

import { state } from "./state.js";
import { MAP_CONFIGS } from "./config.js";
import { t, isPointInPolygon } from "./utils.js";
import { getRegionPolygonsCache } from "./map/markerFactory.js";

const devState = {
  isActive: false,
  currentMode: null,
  selectedMarker: null,
  selectedMarkerData: null,
  changes: new Map(),
  newMarkers: [],
  originalPositions: new Map(),
  regionMode: false,
  currentPolygon: null,
  polygonHandles: [],
  regionEditorUI: null,
};

const HIGHLIGHT_STYLE =
  "filter: drop-shadow(0 0 8px #00ff00) drop-shadow(0 0 16px #00ff00); transform: scale(1.3);";

/**
 * 개발자 도구 모달 생성
 */
const createDevModal = () => {
  if (document.getElementById("dev-tools-modal")) {
    return document.getElementById("dev-tools-modal");
  }

  const modal = document.createElement("div");
  modal.id = "dev-tools-modal";
  modal.className = "dev-tools-panel";
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
                <button class="dev-btn" id="dev-btn-add" title="맵 클릭시 새 마커 추가">
                    <span class="dev-btn-icon">➕</span>
                    <span class="dev-btn-text">새 마커 추가</span>
                </button>
                <button class="dev-btn" id="dev-btn-region" title="영역(폴리곤) 편집">
                    <span class="dev-btn-icon">📐</span>
                    <span class="dev-btn-text">영역 편집</span>
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
 * 새 마커 추가 모달 생성
 */
const createAddMarkerModal = (lat, lng) => {
  let modal = document.getElementById("dev-add-marker-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "dev-add-marker-modal";
    modal.className = "dev-modal-overlay";
    document.body.appendChild(modal);
  }

  let categories = state.mapData.categories || [];
  const config = MAP_CONFIGS[state.currentMapKey];

  if (categories.length <= 1 || (config && config.type === "image")) {
    const allCatIds = Object.keys(state.categoryItemTranslations).filter(
      (id) => id.length > 5 && !isNaN(id),
    );

    if (allCatIds.length > 0) {
      const transCats = allCatIds.map((id) => ({
        id: id,
        name: t(id),
        image: `./icons/${id}.png`,
      }));
      const existingIds = new Set(categories.map((c) => c.id));
      transCats.forEach((c) => {
        if (!existingIds.has(c.id)) {
          categories.push(c);
        }
      });
    }
  }

  if (categories.length === 0) {
    categories = [
      {
        id: "17310010006",
        name: "상자 (지상)",
        image: "./icons/17310010006.png",
      },
      {
        id: "17310010007",
        name: "상자 (지하)",
        image: "./icons/17310010007.png",
      },
      {
        id: "17310010012",
        name: "곡경심유 (파랑나비)",
        image: "./icons/17310010012.png",
      },
      {
        id: "17310010015",
        name: "만물의 울림 (노랑나비)",
        image: "./icons/17310010015.png",
      },
      {
        id: "17310010090",
        name: "야외 제사 (빨간나비)",
        image: "./icons/17310010090.png",
      },
      { id: "17310010083", name: "지역", image: "./icons/17310010083.png" },
      { id: "17310010084", name: "포탈", image: "./icons/17310010084.png" },
    ];
  }

  const sortedCategories = [...categories].sort((a, b) =>
    t(a.name).localeCompare(t(b.name)),
  );

  const categoryItems = sortedCategories
    .map(
      (cat) => `
        <div class="dev-cat-item ${cat.id === "17310010006" ? "active" : ""}" data-id="${cat.id}" title="${t(cat.name)} (${cat.id})">
            <img src="${cat.image}" onerror="this.src='./icons/default.png'">
            <span class="dev-cat-name">${t(cat.name)}</span>
        </div>
    `,
    )
    .join("");

  modal.innerHTML = `
        <div class="dev-modal-content" style="width: 400px;">
            <div class="dev-modal-header">
                <span class="dev-modal-title">✨ 새 마커 추가</span>
                <button class="dev-modal-close" id="dev-add-close">×</button>
            </div>
            <div class="dev-modal-body">
                <div class="dev-form-group">
                    <label>좌표</label>
                    <div class="dev-coords-display">${lat}, ${lng}</div>
                </div>
                <div class="dev-form-group">
                    <label>카테고리 선택</label>
                    <div class="dev-cat-search-wrapper">
                        <input type="text" id="dev-cat-search" placeholder="카테고리 검색...">
                    </div>
                    <div class="dev-cat-grid" id="dev-cat-grid">
                        ${categoryItems}
                    </div>
                    <input type="hidden" id="dev-add-cat" value="17310010006">
                </div>

                <div class="dev-form-group">
                    <label for="dev-add-region">지역 (자동 감지됨)</label>
                    <input type="text" id="dev-add-region" placeholder="지역 이름">
                </div>

                <div class="dev-form-group">
                    <label for="dev-add-title">마커 이름</label>
                    <input type="text" id="dev-add-title" placeholder="마커 이름을 입력하세요" value="새 마커">
                </div>
                <div class="dev-form-group">
                    <label for="dev-add-desc">설명 (선택)</label>
                    <textarea id="dev-add-desc" placeholder="설명을 입력하세요"></textarea>
                </div>
            </div>
            <div class="dev-modal-footer">
                <button class="dev-modal-btn dev-btn-cancel" id="dev-add-cancel">취소</button>
                <button class="dev-modal-btn dev-btn-save" id="dev-add-save">추가하기</button>
            </div>
        </div>
    `;

  modal.style.display = "flex";

  let detectedRegion = "";
  const regionPolygonsCache = getRegionPolygonsCache();
  if (regionPolygonsCache.length > 0) {
    for (const polyObj of regionPolygonsCache) {
      if (
        isPointInPolygon([parseFloat(lat), parseFloat(lng)], polyObj.coords)
      ) {
        detectedRegion = polyObj.title;
        break;
      }
    }
  }
  document.getElementById("dev-add-region").value = detectedRegion;

  const close = () => (modal.style.display = "none");
  document.getElementById("dev-add-close").onclick = close;
  document.getElementById("dev-add-cancel").onclick = close;

  const catGrid = document.getElementById("dev-cat-grid");
  const catInput = document.getElementById("dev-add-cat");
  const catSearch = document.getElementById("dev-cat-search");

  catGrid.addEventListener("click", (e) => {
    const item = e.target.closest(".dev-cat-item");
    if (!item) return;

    catGrid
      .querySelectorAll(".dev-cat-item")
      .forEach((el) => el.classList.remove("active"));
    item.classList.add("active");
    catInput.value = item.dataset.id;
  });

  catSearch.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    catGrid.querySelectorAll(".dev-cat-item").forEach((item) => {
      const name = item
        .querySelector(".dev-cat-name")
        .textContent.toLowerCase();
      const id = item.dataset.id.toLowerCase();
      const isMatch = name.includes(term) || id.includes(term);
      item.style.display = isMatch ? "flex" : "none";
    });
  });

  document.getElementById("dev-add-save").onclick = () => {
    const catId = document.getElementById("dev-add-cat").value;
    const title = document.getElementById("dev-add-title").value;
    const desc = document.getElementById("dev-add-desc").value;
    const region = document.getElementById("dev-add-region").value;

    if (!catId || !title) {
      alert("카테고리와 이름을 입력해주세요.");
      return;
    }

    saveNewMarker(lat, lng, catId, title, desc, region);
    close();
  };
};

/**
 * 신규 마커 저장 및 표시
 */
const saveNewMarker = (lat, lng, catId, title, desc, region) => {
  const newId = Date.now();
  const newMarker = {
    id: newId,
    category: catId,
    title: title,
    originalName: title,
    description: desc,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    region: region,
    regionId: 0,
  };

  devState.newMarkers.push(newMarker);

  const emojiIcon = L.divIcon({
    className: "",
    html: '<div style="font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); cursor: pointer;">✨</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });

  const popupContent = `
        <div style="font-size:12px; line-height:1.4; text-align: center;">
            <b style="font-size:14px; color:#daac71;">${title}</b><br>
            <span style="color:#888;">ID: ${newId}</span><br>
            <span style="color:#aaa;">카테고리: ${catId}</span><br>
            <span style="color:#aaa;">지역: ${region || "미지정"}</span><br>
            <span style="color:#aaa;">좌표: ${lat}, ${lng}</span><br>
            <p style="margin-top:4px; color:#ddd;">${desc || ""}</p>
        </div>
    `;

  L.marker([parseFloat(lat), parseFloat(lng)], { icon: emojiIcon })
    .addTo(state.map)
    .bindPopup(popupContent);

  addLog(`추가됨: ${title} (${newId})`, "success");
  updateUI();
};

/**
 * CSS 스타일 추가
 */
const addDevStyles = () => {
  if (document.getElementById("dev-tools-styles")) return;

  const style = document.createElement("style");
  style.id = "dev-tools-styles";
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

        /* 개발자 모드 활성화 시 맵 오버레이(지역 폴리곤) 클릭 방지 */
        .dev-mode-active .region-polygon {
            pointer-events: none !important;
        }

        /* 좌표 복사 및 마커 추가 모드에서는 기존 마커들도 클릭 방지 (맵 클릭 원활하게) */
        body[data-dev-mode="coords"] .game-marker-icon,
        body[data-dev-mode="add"] .game-marker-icon {
            pointer-events: none !important;
        }

        /* 모달 스타일 */
        .dev-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
        }

        .dev-modal-content {
            width: 320px;
            background: #1a1a1f;
            border: 1px solid #444;
            border-radius: 16px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            overflow: hidden;
            animation: devModalFadeIn 0.3s ease;
        }

        @keyframes devModalFadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .dev-modal-header {
            padding: 16px;
            background: rgba(218, 172, 113, 0.1);
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .dev-modal-title {
            font-weight: 700;
            color: #daac71;
        }

        .dev-modal-close {
            background: none;
            border: none;
            color: #888;
            font-size: 24px;
            cursor: pointer;
        }

        .dev-modal-body {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .dev-form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .dev-form-group label {
            font-size: 12px;
            color: #888;
            font-weight: 600;
        }

        .dev-coords-display {
            font-family: monospace;
            background: #000;
            padding: 8px;
            border-radius: 4px;
            font-size: 13px;
            color: #4ade80;
        }

        .dev-form-group input, 
        .dev-form-group select, 
        .dev-form-group textarea {
            background: #2a2a2f;
            border: 1px solid #444;
            border-radius: 6px;
            padding: 10px;
            color: #fff;
            font-size: 14px;
            width: 100%;
            box-sizing: border-box;
        }

        .dev-cat-input-wrapper {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .dev-cat-preview {
            width: 36px;
            height: 36px;
            background: #000;
            border-radius: 6px;
            border: 1px solid #444;
            padding: 4px;
            object-fit: contain;
        }

        .dev-cat-search-wrapper {
            margin-bottom: 8px;
        }

        .dev-cat-search-wrapper input {
            width: 100%;
            padding: 8px 12px;
            background: #000;
            border: 1px solid #444;
            border-radius: 6px;
            color: #fff;
            font-size: 13px;
        }

        .dev-cat-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            max-height: 240px;
            overflow-y: auto;
            background: #000;
            padding: 10px;
            border-radius: 8px;
            border: 1px solid #444;
        }

        .dev-cat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 10px 6px;
            background: #1a1a1f;
            border: 1px solid #333;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .dev-cat-item:hover {
            background: #25252a;
            border-color: #555;
        }

        .dev-cat-item.active {
            background: rgba(218, 172, 113, 0.2);
            border-color: #daac71;
        }

        .dev-cat-item img {
            width: 32px;
            height: 32px;
            object-fit: contain;
        }

        .dev-cat-name {
            font-size: 10px;
            color: #aaa;
            text-align: center;
            word-break: keep-all;
            line-height: 1.2;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .dev-cat-item.active .dev-cat-name {
            color: #daac71;
            font-weight: 600;
        }


        .dev-form-group textarea {
            height: 80px;
            resize: none;
        }

        .dev-modal-footer {
            padding: 16px;
            background: #141419;
            display: flex;
            gap: 10px;
        }

        .dev-modal-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .dev-btn-cancel {
            background: #333;
            color: #ccc;
        }

        .dev-btn-save {
            background: #daac71;
            color: #000;
        }

        .dev-btn-save:hover {
            background: #e5bc8a;
            transform: translateY(-1px);
        }
    `;

  document.head.appendChild(style);
};

/**
 * 로그 출력
 */
const addLog = (message, type = "info") => {
  const logContent = document.getElementById("dev-log-content");
  if (!logContent) return;

  const time = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const entry = document.createElement("div");
  entry.className = `dev-log-entry dev-log-${type}`;
  entry.innerHTML = `<span class="dev-log-time">${time}</span>${message}`;

  logContent.insertBefore(entry, logContent.firstChild);

  while (logContent.children.length > 20) {
    logContent.removeChild(logContent.lastChild);
  }
};

/**
 * UI 업데이트
 */
const updateUI = () => {
  const modeDisplay = document.getElementById("dev-current-mode");
  if (modeDisplay) {
    const modeNames = {
      move: "📍 마커 이동",
      coords: "📋 좌표 복사",
      inspect: "🔍 정보 보기",
      region: "📐 영역 편집",
    };
    modeDisplay.textContent = devState.currentMode
      ? modeNames[devState.currentMode]
      : "없음";
  }

  const changeCount = document.getElementById("dev-change-count");
  if (changeCount) {
    const total = devState.changes.size + devState.newMarkers.length;
    changeCount.textContent = `${total}개 (수정:${devState.changes.size}, 추가:${devState.newMarkers.length})`;
  }

  ["move", "coords", "inspect", "add", "region"].forEach((mode) => {
    const btn = document.getElementById(`dev-btn-${mode}`);
    if (btn) {
      btn.classList.toggle("active", devState.currentMode === mode);
    }
  });

  const selectedInfo = document.getElementById("dev-selected-info");
  if (selectedInfo) {
    if (devState.selectedMarkerData) {
      const m = devState.selectedMarkerData;
      selectedInfo.style.display = "flex";
      selectedInfo.style.flexDirection = "column";
      selectedInfo.style.gap = "4px";
      selectedInfo.innerHTML = `
                <div class="dev-info-row"><span class="dev-info-label">이름</span><span class="dev-info-value" style="color:#daac71">${m.originalName || m.title || m.name}</span></div>
                <div class="dev-info-row"><span class="dev-info-label">ID</span><span class="dev-info-value">${m.id}</span></div>
                <div class="dev-info-row"><span class="dev-info-label">지역</span><span class="dev-info-value">${m.region || "-"}</span></div>
                <div class="dev-info-row"><span class="dev-info-label">좌표</span><span class="dev-info-value">${parseFloat(m.lat).toFixed(4)}, ${parseFloat(m.lng).toFixed(4)}</span></div>
                <div class="dev-info-row"><span class="dev-info-label">카테고리</span><span class="dev-info-value">${m.category}</span></div>
            `;
    } else {
      selectedInfo.style.display = "none";
    }
  }
};

/**
 * 모드 설정
 */
const setMode = (mode) => {
  if (devState.currentMode === "region" && mode !== "region") {
    stopRegionMode();
  }

  if (devState.currentMode === mode) {
    if (mode === "region") {
      stopRegionMode();
    }
    devState.currentMode = null;
    clearSelection();
    addLog(`모드 해제`, "info");
  } else {
    devState.currentMode = mode;
    clearSelection();
    const modeMessages = {
      move: "마커를 클릭하세요",
      coords: "맵을 클릭하면 좌표가 복사됩니다",
      inspect: "마커를 클릭하면 정보가 출력됩니다",
      add: "맵을 클릭하여 새 마커를 추가하세요",
      region: "영역 편집 패널을 사용하여 폴리곤을 그리세요",
    };

    addLog(modeMessages[mode], "info");

    if (mode === "region") {
      startRegionMode();
    }
  }
  document.body.setAttribute("data-dev-mode", devState.currentMode || "none");
  updateUI();
};

/**
 * 선택 해제
 */
const clearSelection = () => {
  if (devState.selectedMarker) {
    const icon = devState.selectedMarker.getElement?.();
    if (icon) {
      icon.classList.remove("dev-selected-marker");
    }
  }
  devState.selectedMarker = null;
  devState.selectedMarkerData = null;
  updateUI();
};

/**
 * 마커 클릭 핸들러 (CPU 모드 Leaflet 마커용)
 */
const handleMarkerClick = (e) => {
  if (!devState.isActive || !devState.currentMode) return;

  const marker = e.target;
  const markerData = Array.from(state.allMarkers.values()).find(
    (m) => m.marker === marker,
  );

  if (!markerData) return;

  marker.closePopup();

  handleMarkerAction(markerData, marker);

  e.originalEvent?.stopPropagation();
};

/**
 * GPU 모드 마커 클릭 핸들러 (ID 기반)
 */
const handleGpuMarkerClick = (markerId) => {
  if (!devState.isActive || !devState.currentMode) return;

  const markerData =
    state.allMarkers.get(markerId) || state.allMarkers.get(String(markerId));
  if (!markerData) return;

  if (state.map && state.map._popup) {
    state.map.closePopup();
  }

  handleMarkerAction(markerData, null);
};

/**
 * 마커 액션 처리 (공통)
 */
const handleMarkerAction = (markerData, leafletMarker) => {
  if (devState.currentMode === "move") {
    clearSelection();

    devState.selectedMarker = leafletMarker;
    devState.selectedMarkerData = markerData;

    if (leafletMarker) {
      const icon = leafletMarker.getElement?.();
      if (icon) {
        icon.classList.add("dev-selected-marker");
      }
    }

    addLog(`선택: ${markerData.originalName || markerData.id}`, "info");
    updateUI();
  } else if (devState.currentMode === "inspect") {
    const info = {
      id: markerData.id,
      name: markerData.originalName,
      category: markerData.category,
      lat: markerData.lat,
      lng: markerData.lng,
      region: markerData.region,
    };

    console.log(
      "%c🔍 마커 정보",
      "color: #60a5fa; font-size: 14px; font-weight: bold;",
    );
    console.table(info);

    addLog(`정보 출력: ${markerData.originalName || markerData.id}`, "success");
  }
};

/**
 * 맵 클릭 핸들러
 */
const handleMapClick = (e) => {
  if (!devState.isActive || !devState.currentMode) return;

  const lat = e.latlng.lat.toFixed(6);
  const lng = e.latlng.lng.toFixed(6);

  if (devState.currentMode === "coords") {
    const coordsText = `["${lat}"|"${lng}"]`;
    navigator.clipboard
      .writeText(coordsText)
      .then(() => {
        addLog(`복사됨: ${coordsText}`, "success");
      })
      .catch(() => {
        addLog(`좌표: ${coordsText}`, "info");
      });
  } else if (devState.currentMode === "move" && devState.selectedMarkerData) {
    const markerData = devState.selectedMarkerData;
    const originalLat = markerData.lat;
    const originalLng = markerData.lng;

    if (!devState.originalPositions.has(markerData.id)) {
      devState.originalPositions.set(markerData.id, {
        lat: originalLat,
        lng: originalLng,
      });
    }

    if (
      devState.selectedMarker &&
      typeof devState.selectedMarker.setLatLng === "function"
    ) {
      devState.selectedMarker.setLatLng([parseFloat(lat), parseFloat(lng)]);
    }

    if (state.gpuRenderMode) {
      import("./map/pixiOverlay/overlayCore.js").then((m) =>
        m.updatePixiMarkers(),
      );
    }
    markerData.lat = parseFloat(lat);
    markerData.lng = parseFloat(lng);

    devState.changes.set(markerData.id, {
      id: markerData.id,
      name: markerData.originalName,
      category: markerData.category,
      original: devState.originalPositions.get(markerData.id),
      modified: { lat: parseFloat(lat), lng: parseFloat(lng) },
    });

    const icon = devState.selectedMarker.getElement?.();
    if (icon) {
      icon.classList.remove("dev-selected-marker");
      icon.classList.add("dev-modified-marker");
    }

    addLog(`이동 완료: ${markerData.originalName || markerData.id}`, "success");
    console.log(`%c✅ 마커 이동`, "color: #4ade80; font-weight: bold;", {
      id: markerData.id,
      name: markerData.originalName,
      from: `${originalLat}, ${originalLng}`,
      to: `${lat}, ${lng}`,
    });

    clearSelection();
  } else if (devState.currentMode === "add") {
    createAddMarkerModal(lat, lng);
  } else if (devState.currentMode === "region") {
    addPolygonPoint(e.latlng);
  }
};

/**
 * 마우스 이동 핸들러 (좌표 표시)
 */
const handleMouseMove = (e) => {
  if (!devState.isActive) return;

  const coordsDisplay = document.getElementById("dev-mouse-coords");
  if (coordsDisplay) {
    coordsDisplay.textContent = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
  }
};

/**
 * 변경사항 내보내기
 */
const exportChanges = () => {
  if (devState.changes.size === 0) {
    addLog("변경된 마커가 없습니다", "warn");
    return;
  }

  const changesArray = Array.from(devState.changes.values());

  const jsonOutput = changesArray.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    latitude: c.modified.lat,
    longitude: c.modified.lng,
    customPosition: `[${c.modified.lat}|${c.modified.lng}]`,
    _original: c.original,
  }));

  const csvLines = changesArray.map((c) => {
    const category = c.category || "";
    const id = c.id;
    const name = c.name || "";

    return `Override,"${category}","${id}","${name}","","","","","[${c.modified.lat}|${c.modified.lng}]"`;
  });
  const csvOutput = csvLines.join("\n");

  console.log(
    "%c📋 변경된 마커 목록 (JSON)",
    "color: #daac71; font-size: 16px; font-weight: bold;",
  );
  console.log(JSON.stringify(jsonOutput, null, 2));

  console.log(
    "%c📋 CSV 형식 (translation.csv에 붙여넣기)",
    "color: #4ade80; font-size: 14px; font-weight: bold;",
  );
  console.log(csvOutput);

  navigator.clipboard.writeText(csvOutput).then(() => {
    addLog(`${changesArray.length}개 마커 CSV 복사됨`, "success");
  });

  if (devState.newMarkers.length > 0) {
    const newMarkersCsv = devState.newMarkers
      .map(
        (m) =>
          `${m.id},${m.category_id},"${m.title}","${m.description}",${m.latitude},${m.longitude},${m.regionId},,""`,
      )
      .join("\n");

    const currentMap =
      state.currentMapKey === "qinghe" ? "data3.csv" : "data4.csv";

    console.log(
      `%c📋 신규 마커 목록 (${currentMap}용)`,
      "color: #daac71; font-size: 16px; font-weight: bold;",
    );
    console.log(
      "id,category_id,title,description,latitude,longitude,regionId,image,video_url",
    );
    console.log(newMarkersCsv);

    addLog(`${devState.newMarkers.length}개 신규 마커 콘솔 출력됨`, "success");
  }

  const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
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
    addLog("초기화할 변경사항이 없습니다", "warn");
    return;
  }

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
          icon.classList.remove("dev-modified-marker");
        }
      }
    }
  });

  const count = devState.changes.size + devState.newMarkers.length;
  devState.changes.clear();
  devState.newMarkers.clear
    ? devState.newMarkers.clear()
    : (devState.newMarkers = []);
  devState.originalPositions.clear();

  addLog(`${count}개 변경사항 초기화됨`, "success");
  updateUI();
};

/**
 * 이벤트 바인딩
 */
const bindDevEvents = () => {
  document.getElementById("dev-close-btn")?.addEventListener("click", () => {
    stopDev();
  });

  document
    .getElementById("dev-btn-move")
    ?.addEventListener("click", () => setMode("move"));
  document
    .getElementById("dev-btn-coords")
    ?.addEventListener("click", () => setMode("coords"));
  document
    .getElementById("dev-btn-inspect")
    ?.addEventListener("click", () => setMode("inspect"));
  document
    .getElementById("dev-btn-add")
    ?.addEventListener("click", () => setMode("add"));
  document
    .getElementById("dev-btn-region")
    ?.addEventListener("click", () => toggleRegionEditor());

  document
    .getElementById("dev-btn-export")
    ?.addEventListener("click", exportChanges);
  document
    .getElementById("dev-btn-reset")
    ?.addEventListener("click", resetAllChanges);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && devState.isActive) {
      if (devState.selectedMarker) {
        clearSelection();
        addLog("선택 해제됨", "info");
      } else if (devState.currentMode) {
        setMode(devState.currentMode);
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
      data.marker.off("click", handleMarkerClick);
      data.marker.on("click", handleMarkerClick);
    }
  });
};

/**
 * 개발자 도구 시작
 */
const startDev = () => {
  if (devState.isActive) {
    console.log(
      "%c🔧 개발자 도구가 이미 활성화되어 있습니다.",
      "color: #fbbf24;",
    );
    return;
  }

  devState.isActive = true;
  document.body.classList.add("dev-mode-active");
  if (state.isDevMode === false) state.isDevMode = true;

  const modal = createDevModal();
  modal.style.display = "block";

  if (state.map) {
    state.map.on("click", handleMapClick);
    state.map.on("mousemove", handleMouseMove);
  }

  attachMarkerListeners();

  console.log(
    "%c🔧 개발자 도구가 활성화되었습니다!",
    "color: #4ade80; font-size: 16px; font-weight: bold;",
  );
  console.log("%c사용법: 모달에서 모드를 선택하세요.", "color: #888;");

  addLog("개발자 도구 시작!", "success");
  updateUI();
};

/**
 * 개발자 도구 종료
 */
const stopDev = () => {
  devState.isActive = false;
  document.body.classList.remove("dev-mode-active");
  document.body.removeAttribute("data-dev-mode");
  state.isDevMode = false;

  devState.currentMode = null;
  clearSelection();

  const modal = document.getElementById("dev-tools-modal");
  if (modal) {
    modal.style.display = "none";
  }

  if (state.map) {
    state.map.off("click", handleMapClick);
    state.map.off("mousemove", handleMouseMove);
  }

  console.log("%c🔧 개발자 도구가 비활성화되었습니다.", "color: #888;");
};

const dev = () => {
  startDev();
};

dev.stop = stopDev;
dev.export = exportChanges;
dev.reset = resetAllChanges;
dev.changes = () => devState.changes;
dev.handleGpuClick = handleGpuMarkerClick;
dev.help = () => {
  console.log(
    `
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
    "color: #daac71; font-size: 16px; font-weight: bold;",
    "color: #444;",
    "color: #4ade80; font-weight: bold;",
    "color: #888;",
    "color: #60a5fa; font-weight: bold;",
    "color: #888;",
    "color: #fbbf24; font-weight: bold;",
    "color: #888;",
  );
};

window.dev = dev;

const toggleRegionEditor = () => {
  if (devState.currentMode === "region") {
    setMode(null);
  } else {
    setMode("region");
  }
};

const startRegionMode = () => {
  devState.regionMode = true;
  createRegionEditorUI();
  document.getElementById("region-editor-ui").style.display = "flex";
  addLog("영역 편집 모드 시작", "info");
};

const stopRegionMode = () => {
  devState.regionMode = false;
  const ui = document.getElementById("region-editor-ui");
  if (ui) ui.style.display = "none";
  clearPolygon();
  addLog("영역 편집 모드 종료", "info");
};

const createRegionEditorUI = () => {
  if (document.getElementById("region-editor-ui")) return;

  const container = document.createElement("div");
  container.id = "region-editor-ui";
  container.style.cssText = `
        position: fixed;
        top: 80px;
        right: 320px; /* dev panel width + margin */
        background: rgba(20, 20, 25, 0.95);
        padding: 16px;
        border-radius: 12px;
        z-index: 9999;
        display: none;
        flex-direction: column;
        gap: 10px;
        color: white;
        border: 1px solid #444;
        width: 200px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
    `;

  container.innerHTML = `
        <h4 style="margin: 0 0 5px 0; color: var(--accent); text-align: center; font-size: 14px;">📐 Region Editor</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <button id="btn-clear-polygon" class="dev-btn" style="justify-content: center; border-color: #ff6b6b; color: #ff6b6b;">Reset (Clear)</button>
            <button id="btn-export-region" class="dev-btn dev-action-export" style="justify-content: center;">Export JSON</button>
        </div>
        <div style="font-size: 11px; color: #888; margin-top: 5px; line-height: 1.4;">
            • 좌클릭: 점 추가<br>
            • 드래그: 점 이동<br>
            • 우클릭: 점 삭제
        </div>
    `;

  document.body.appendChild(container);

  document.getElementById("btn-clear-polygon").onclick = clearPolygon;
  document.getElementById("btn-export-region").onclick = exportRegionJSON;
};

const startNewPolygon = () => {
  clearPolygon();
  devState.currentPolygon = L.polygon([], {
    color: "#ff4444",
    weight: 3,
  }).addTo(state.map);
  addLog("새 폴리곤 그리기 시작", "info");
};

const clearPolygon = () => {
  if (devState.currentPolygon) {
    state.map.removeLayer(devState.currentPolygon);
    devState.currentPolygon = null;
  }
  devState.polygonHandles.forEach((h) => state.map.removeLayer(h));
  devState.polygonHandles = [];
};

const updatePolygonShape = () => {
  if (!devState.currentPolygon) return;
  const latlngs = devState.polygonHandles.map((h) => h.getLatLng());
  devState.currentPolygon.setLatLngs(latlngs);
};

const addPolygonPoint = (latlng) => {
  if (!devState.currentPolygon) startNewPolygon();

  const handle = L.marker(latlng, {
    draggable: true,
    icon: L.divIcon({
      className: "region-handle",
      html: '<div style="width: 12px; height: 12px; background: white; border: 2px solid #ff4444; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
  }).addTo(state.map);

  handle.on("drag", updatePolygonShape);
  handle.on("contextmenu", () => {
    state.map.removeLayer(handle);
    devState.polygonHandles = devState.polygonHandles.filter(
      (h) => h !== handle,
    );
    updatePolygonShape();
  });

  devState.polygonHandles.push(handle);
  updatePolygonShape();
};

const exportRegionJSON = () => {
  if (!devState.currentPolygon) {
    alert("내보낼 폴리곤이 없습니다!");
    return;
  }

  const latlngs = devState.currentPolygon.getLatLngs()[0];
  if (!latlngs || latlngs.length < 3) {
    alert("최소 3개의 점이 필요합니다.");
    return;
  }

  const coordinates = latlngs.map((ll) => [String(ll.lng), String(ll.lat)]);

  if (coordinates.length > 0) {
    coordinates.push(coordinates[0]);
  }

  const center = devState.currentPolygon.getBounds().getCenter();

  const json = {
    mapId: 3003,
    title: "New Region",
    zoom: 12,
    latitude: String(center.lat),
    longitude: String(center.lng),
    coordinates: coordinates,
    id: Date.now(),
    map_id: 3003,
  };

  console.log(JSON.stringify(json, null, 4));

  navigator.clipboard.writeText(JSON.stringify(json, null, 4)).then(() => {
    alert("JSON이 클립보드에 복사되었습니다! (콘솔 확인)");
    addLog("Region JSON 복사됨", "success");
  });
};

const loadRegion = (region) => {
  if (devState.currentMode !== "region") {
    setMode("region");
  }

  clearPolygon();

  if (!region.coordinates || region.coordinates.length === 0) {
    alert("좌표 데이터가 없는 지역입니다.");
    return;
  }

  const latlngs = region.coordinates.map((coord) => [
    parseFloat(coord[1]),
    parseFloat(coord[0]),
  ]);

  devState.currentPolygon = L.polygon(latlngs, {
    color: "#4444ff",
    weight: 3,
  }).addTo(state.map);

  latlngs.forEach((ll) => {
    const handle = L.marker(ll, {
      draggable: true,
      icon: L.divIcon({
        className: "region-handle",
        html: '<div style="width: 12px; height: 12px; background: white; border: 2px solid #ff4444; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(state.map);

    handle.on("drag", updatePolygonShape);
    handle.on("contextmenu", () => {
      state.map.removeLayer(handle);
      devState.polygonHandles = devState.polygonHandles.filter(
        (h) => h !== handle,
      );
      updatePolygonShape();
    });

    devState.polygonHandles.push(handle);
  });

  addLog(`${region.title} 영역 편집 시작`, "success");
};

dev.loadRegion = loadRegion;
dev.isRegionMode = () => devState.currentMode === "region";

export { dev, startDev, stopDev };
