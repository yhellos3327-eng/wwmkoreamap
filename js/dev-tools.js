// @ts-check
/**
 * 개발자 도구 모듈.
 * 콘솔에서 dev()를 실행하여 활성화하세요.
 * @module dev-tools
 */

import { state, setState } from "./state.js";
import { MAP_CONFIGS } from "./config.js";
import { t, isPointInPolygon } from "./utils.js";
import { getRegionPolygonsCache } from "./map/markerFactory.js";

export const devState = {
  isActive: false,
  currentMode: null,
  isDeleteMode: false,
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
                <button class="dev-btn" id="dev-btn-test-dup" title="현재 위치에 중복 마커 생성 테스트" style="background: rgba(218, 172, 113, 0.1); border-color: rgba(218, 172, 113, 0.4);">
                    <span class="dev-btn-icon">🧪</span>
                    <span class="dev-btn-text">중복 마커 테스트</span>
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
export const createAddMarkerModal = (lat, lng) => {
  // 기존 모달이 있으면 제거 후 새로 생성 (temp marker 재생성 보장)
  let modal = document.getElementById("dev-add-marker-modal");
  if (modal) {
    modal.remove();
  }

  modal = document.createElement("div");
  modal.id = "dev-add-marker-modal";
  modal.className = "dev-modal-overlay";
  document.body.appendChild(modal);

  // 임시 핀 로직
  if (devState.tempMarker) {
    state.map.removeLayer(devState.tempMarker);
  }
  const pinIcon = /** @type {any} */ (L).divIcon({
    className: "",
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); fill: #ff4444;">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
  devState.tempMarker = /** @type {any} */ (L).marker([lat, lng], { icon: pinIcon, zIndexOffset: 1000 }).addTo(state.map);

  let categories = state.mapData.categories || [];
  const config = MAP_CONFIGS[state.currentMapKey];

  if (categories.length <= 1 || (config && config.type === "image")) {
    const allCatIds = Object.keys(state.categoryItemTranslations).filter(
      (id) => id.length > 5 && !isNaN(Number(id)),
    );

    if (allCatIds.length > 0) {
      const transCats = allCatIds.map((id) => ({
        id: id,
        name: t(id) || id,
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
    String(t(a.name)).localeCompare(String(t(b.name))),
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
                <span class="dev-modal-title" style="display: flex; align-items: center; gap: 8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; color: #daac71;">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                    커뮤니티 마커 추가
                </span>
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
                    <label>이미지 첨부 (선택)</label>
                    <div class="dev-drop-zone" id="dev-drop-zone" style="position: relative; z-index: 10;">
                        <input type="file" id="dev-add-screenshot" accept="image/*" style="opacity: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: pointer; z-index: 20;">
                        <div class="dev-drop-message" id="dev-drop-message" style="pointer-events: none;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #daac71; margin-bottom: 8px;">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            <span>클릭하거나 이미지를 드래그하세요</span>
                        </div>
                        <div class="dev-drop-preview" id="dev-drop-preview" style="pointer-events: none;"></div>
                        <div class="dev-drop-remove" id="dev-drop-remove" style="display: none; pointer-events: auto; z-index: 30;">×</div>
                    </div>
                    <input type="text" id="dev-add-image-url" placeholder="또는 이미지 URL 입력 (GIF 지원)" style="margin-top: 8px;">
                </div>
                <div class="dev-form-group">
                    <label for="dev-add-video">유튜브/영상 URL (선택)</label>
                    <input type="text" id="dev-add-video" placeholder="유튜브 링크 등">
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
  /** @type {HTMLInputElement} */ (document.getElementById("dev-add-region")).value = detectedRegion;

  const close = () => closeAddMarkerModal();
  document.getElementById("dev-add-close").onclick = close;
  document.getElementById("dev-add-cancel").onclick = close;

  const catGrid = document.getElementById("dev-cat-grid");
  const catInput = /** @type {HTMLInputElement} */ (document.getElementById("dev-add-cat"));
  const catSearch = document.getElementById("dev-cat-search");

  // 드래그 앤 드롭 로직
  const dropZone = document.getElementById("dev-drop-zone");
  const fileInput = /** @type {HTMLInputElement} */ (document.getElementById("dev-add-screenshot"));
  const preview = document.getElementById("dev-drop-preview");
  const dropMessage = document.getElementById("dev-drop-message");
  const removeBtn = document.getElementById("dev-drop-remove");

  const resetFile = (e) => {
    if (e) e.stopPropagation();
    fileInput.value = "";
    preview.style.backgroundImage = "";
    preview.classList.remove("active");
    dropMessage.style.display = "flex";
    removeBtn.style.display = "none";
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;

    try {
      const objectUrl = URL.createObjectURL(file);
      preview.style.backgroundImage = `url('${objectUrl}')`;
      preview.classList.add("active");
      dropMessage.style.display = "none";
      removeBtn.style.display = "flex";

      // 파일 입력을 안전하게 업데이트
      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
      } catch (dtError) {
        console.warn("DataTransfer not supported, manual file sync might fail on drop", dtError);
        // 폴백: 입력의 임시 속성에 저장
        /** @type {any} */ (fileInput)._droppedFile = file;
      }
    } catch (err) {
      console.error("File processing error:", err);
    }
  };

  // 입력이 영역을 덮으므로 클릭은 입력에 의해 자동으로 처리됩니다.
  // 파일 선택만 처리하면 됩니다.

  removeBtn.addEventListener("click", (e) => {
    e.preventDefault(); // Prevent input click
    e.stopPropagation();
    resetFile();
  });

  fileInput.addEventListener("change", (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files[0];
    handleFile(file);
  });

  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    fileInput.addEventListener(eventName, preventDefaults, false); // Add this
    // Also prevent on the whole modal to prevent accidental navigation
    modal.addEventListener(eventName, preventDefaults, false);
  });

  dropZone.addEventListener("dragover", () => {
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  const handleDrop = (e) => {
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  dropZone.addEventListener("drop", handleDrop);
  fileInput.addEventListener("drop", handleDrop);

  catGrid.addEventListener("click", (e) => {
    const item = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target).closest(".dev-cat-item"));
    if (!item) return;

    catGrid
      .querySelectorAll(".dev-cat-item")
      .forEach((el) => el.classList.remove("active"));
    item.classList.add("active");
    catInput.value = item.dataset.id;
  });

  catSearch.addEventListener("input", (e) => {
    const term = /** @type {HTMLInputElement} */ (e.target).value.toLowerCase();
    catGrid.querySelectorAll(".dev-cat-item").forEach((/** @type {any} */ item) => {
      const name = item
        .querySelector(".dev-cat-name")
        .textContent.toLowerCase();
      const id = item.dataset.id.toLowerCase();
      const isMatch = name.includes(term) || id.includes(term);
      item.style.display = isMatch ? "flex" : "none";
    });
  });

  document.getElementById("dev-add-save").onclick = () => {
    const catId = /** @type {HTMLInputElement} */ (document.getElementById("dev-add-cat")).value;
    const title = /** @type {HTMLInputElement} */ (document.getElementById("dev-add-title")).value;
    const desc = /** @type {HTMLTextAreaElement} */ (document.getElementById("dev-add-desc")).value;
    const region = /** @type {HTMLInputElement} */ (document.getElementById("dev-add-region")).value;
    const screenshotInput = /** @type {any} */ (document.getElementById("dev-add-screenshot"));
    const screenshotFile = screenshotInput.files[0] || screenshotInput._droppedFile;
    const imageUrl = /** @type {HTMLInputElement} */ (document.getElementById("dev-add-image-url")).value;
    const videoUrl = /** @type {HTMLInputElement} */ (document.getElementById("dev-add-video")).value;

    if (!catId || !title) {
      alert("카테고리와 이름을 입력해주세요.");
      return;
    }

    saveNewMarker(lat, lng, catId, title, desc, region, screenshotFile, videoUrl, imageUrl);
    close();
  };
};

/**
 * 신규 마커 저장 및 표시
 */
import { BACKEND_URL } from "./config.js";
import { isLoggedIn } from "./auth.js";

/**
 * 신규 마커 저장 및 표시
 */
const saveNewMarker = async (lat, lng, catId, title, desc, region, screenshotFile, videoUrl, imageUrl) => {
  const isCommunityMode = state.showCommunityMarkers;
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isDev = !isCommunityMode && (isLocal || devState.isActive);

  if (!isDev && !isLoggedIn()) {
    import("./sync/ui.js").then(({ showSyncToast }) => {
      showSyncToast("로그인이 필요합니다.", "error");
    });
    return;
  }

  try {
    let newMarkerData;

    if (isDev) {
      // 로컬 등록
      const newId = Date.now();
      let uploadedImageUrl = imageUrl || "";

      // 일관된 URL 생성을 위해 이미지를 백엔드에 업로드 (파일이 있고 외부 URL이 없는 경우에만)
      if (screenshotFile && !imageUrl) {
        try {
          const uploadFormData = new FormData();
          uploadFormData.append("screenshot", screenshotFile);

          addLog("이미지 업로드 중...", "info");
          const uploadRes = await fetch(`${BACKEND_URL}/api/markers/upload`, {
            method: "POST",
            body: uploadFormData
          });

          if (!uploadRes.ok) throw new Error(`HTTP ${uploadRes.status}`);

          const uploadData = await uploadRes.json();
          if (uploadData.success) {
            uploadedImageUrl = uploadData.url;
            addLog("이미지 업로드 완료", "success");
          } else {
            throw new Error(uploadData.error || "Upload failed");
          }
        } catch (e) {
          console.error("Local image upload failed:", e);
          addLog(`이미지 업로드 실패: ${e.message}`, "warn");
        }
      }

      newMarkerData = {
        id: String(newId),
        title: title,
        description: desc || "",
        type: catId,
        category_id: catId, // For CSV export
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        region: region || "",
        regionId: 0,
        mapId: state.currentMapKey || 'qinghe',
        screenshot: screenshotFile ? URL.createObjectURL(screenshotFile) : (imageUrl || null),
        uploadedImage: uploadedImageUrl,
        video: videoUrl || null,
        status: 'approved'
      };

      addLog(`로컬 등록됨: ${title} (${newId})`, "success");
    } else {
      // 백엔드 등록
      const formData = new FormData();
      formData.append("lat", String(parseFloat(lat)));
      formData.append("lng", String(parseFloat(lng)));
      formData.append("title", title);
      formData.append("description", desc || "");
      formData.append("type", catId);
      if (region) formData.append("region", region);
      formData.append("mapId", state.currentMapKey || 'qinghe');
      formData.append("status", "approved");
      if (screenshotFile) formData.append("screenshot", screenshotFile);
      if (imageUrl) formData.append("imageUrl", imageUrl); // Assuming backend supports this!
      if (videoUrl) formData.append("video", videoUrl);

      const response = await fetch(`${BACKEND_URL}/api/markers`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "마커 생성 실패");
      }

      newMarkerData = data.marker;

      // CSV 내보내기에 필요한 속성 확인
      if (!newMarkerData.latitude && newMarkerData.lat) newMarkerData.latitude = newMarkerData.lat;
      if (!newMarkerData.longitude && newMarkerData.lng) newMarkerData.longitude = newMarkerData.lng;
      if (!newMarkerData.category_id && newMarkerData.type) newMarkerData.category_id = newMarkerData.type;

      addLog(`서버 저장됨: ${title} (${newMarkerData.id})`, "success");
    }

    const newId = newMarkerData.id;

    if (!isCommunityMode) {
      devState.newMarkers.push(newMarkerData);
    }

    // 백엔드 마커: state.communityMarkers에 즉시 추가 → 새로고침 없이도 표시
    if (!isDev) {
      state.communityMarkers.set(String(newMarkerData.id), {
        id: String(newMarkerData.id),
        name: newMarkerData.title,
        description: newMarkerData.description,
        category: newMarkerData.type,
        lat: parseFloat(newMarkerData.lat),
        lng: parseFloat(newMarkerData.lng),
        isBackend: true,
        images: newMarkerData.screenshot ? [newMarkerData.screenshot] : [],
        video_url: newMarkerData.video ? [newMarkerData.video] : [],
        votes: 0,
        user_id: null,
        region: newMarkerData.region || '',
        status: newMarkerData.status || 'pending',
      });
    }

    const svgIcon = /** @type {any} */ (L).divIcon({
      className: "",
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); cursor: pointer; fill: #daac71;">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    const { createPopupHtml } = await import("./map/popup.js");
    const popupContent = createPopupHtml(
      {
        id: String(newId),
        name: title,
        description: (desc || "").replace(/<[^>]*>/g, ""),
        category: catId,
        mapId: state.currentMapKey || 'qinghe',
        images: isDev ? [newMarkerData.uploadedImage || newMarkerData.screenshot].filter(Boolean) : (newMarkerData.images || [newMarkerData.screenshot]).filter(Boolean),
        video_url: videoUrl ? [videoUrl] : [],
        isBackend: true,
        status: isDev ? 'pending' : (newMarkerData.status || 'approved'),
        votes: 0,
        user_id: null
      },
      parseFloat(lat),
      parseFloat(lng),
      region || ""
    );

    /** @type {any} */ (L).marker([parseFloat(lat), parseFloat(lng)], { icon: svgIcon })
      .addTo(state.map)
      .bindPopup(popupContent);

    updateUI();

    if (!isDev) {
      if (isCommunityMode) {
        import("./sync/ui.js").then(({ showSyncToast }) => {
          showSyncToast("마커가 추가되었습니다!", "success");
        });
      } else {
        alert("마커가 추가되었습니다. 관리자 승인 후 공개됩니다.");
      }
    } else {
      console.log(`[DEV] Local marker added: ${title} (${newId})`);

      // data3/4.csv 형식으로 클립보드에 자동 복사
      const csvTitle = title.includes(",") ? `"${title}"` : title;
      const csvDesc = desc ? `"${desc.replace(/"/g, '""')}"` : '""';
      const csvLat = parseFloat(lat).toFixed(6);
      const csvLng = parseFloat(lng).toFixed(6);

      // 이미지: 업로드된 경우 [URL] 형식
      const csvImage = newMarkerData.uploadedImage ? `[${newMarkerData.uploadedImage}]` : "";
      const csvVideo = videoUrl || "";

      const csvLine = `${newId},${catId},${csvTitle},${csvDesc},${csvLat},${csvLng},${region || ""},${csvImage},${csvVideo}`;

      navigator.clipboard.writeText(csvLine).then(() => {
        addLog("CSV 데이터(이미지 포함)가 클립보드에 복사되었습니다.", "success");
      });
    }

  } catch (error) {
    console.error("Save marker error:", error);
    addLog(`오류: ${error.message}`, "warn");
    alert(`저장 실패: ${error.message}`);
  }
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
            background: rgba(0, 0, 0, 0); /* Removed opacity */
            display: none;
            justify-content: flex-end; /* Right align */
            align-items: flex-start; /* Top align */
            z-index: 10000;
            pointer-events: none; /* Allow clicking through to map */
            padding: 20px;
            box-sizing: border-box;
        }

        .dev-modal-content {
            width: 340px;
            max-height: 80vh;
            background: rgba(20, 20, 25, 0.85); /* Semi-transparent dark */
            backdrop-filter: blur(12px); /* Glass effect */
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            overflow-y: auto;
            animation: devModalFadeIn 0.3s ease;
            pointer-events: auto;
            margin-right: 20px;
            margin-top: 20px;
            color: #e0e0e0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .dev-modal-content::-webkit-scrollbar {
            width: 6px;
        }
        .dev-modal-content::-webkit-scrollbar-track {
            background: transparent;
        }
        .dev-modal-content::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .dev-modal-header {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .dev-modal-title {
            font-size: 16px;
            font-weight: 700;
            color: #fff;
            letter-spacing: -0.02em;
        }

        .dev-modal-close {
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            font-size: 24px;
            line-height: 1;
            cursor: pointer;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .dev-modal-close:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.1);
        }

        .dev-modal-body {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .dev-form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .dev-form-group label {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 600;
        }

        .dev-coords-display {
            font-family: 'JetBrains Mono', monospace;
            background: rgba(0, 0, 0, 0.3);
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 13px;
            color: #4ade80;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .dev-form-group input, 
        .dev-form-group select, 
        .dev-form-group textarea {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 10px 12px;
            color: #fff;
            font-size: 14px;
            width: 100%;
            box-sizing: border-box;
            transition: border-color 0.2s, background-color 0.2s;
        }

        .dev-form-group input:focus, 
        .dev-form-group select:focus, 
        .dev-form-group textarea:focus {
            outline: none;
            border-color: #4a9eff;
            background: rgba(0, 0, 0, 0.4);
        }

        .dev-cat-search-wrapper input {
            width: 100%;
            padding: 10px 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #fff;
            font-size: 13px;
            margin-bottom: 8px;
        }
        .dev-cat-search-wrapper input:focus {
            border-color: #daac71;
        }

        .dev-cat-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            max-height: 200px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.2);
            padding: 8px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .dev-cat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 12px 8px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid transparent;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .dev-cat-item:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.1);
        }

        .dev-cat-item.active {
            background: rgba(218, 172, 113, 0.15);
            border-color: #daac71;
            box-shadow: 0 0 10px rgba(218, 172, 113, 0.1);
        }

        .dev-cat-item.active .dev-cat-name {
            color: #daac71;
            font-weight: 700;
        }

        .dev-cat-item img {
            width: 32px;
            height: 32px;
            object-fit: contain;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        .dev-cat-name {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            text-align: center;
            line-height: 1.3;
        }

        .dev-form-group textarea {
            height: 80px;
            resize: vertical;
        }

        .dev-modal-footer {
            padding: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            gap: 12px;
        }

        .dev-modal-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .dev-btn-cancel {
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.7);
        }
        .dev-btn-cancel:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }

        .dev-btn-save {
            background: linear-gradient(135deg, #daac71, #b8864c);
            color: #000;
            box-shadow: 0 4px 12px rgba(218, 172, 113, 0.3);
        }
        .dev-btn-save:hover {
            filter: brightness(1.1);
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(218, 172, 113, 0.4);
        }
        
        .dev-btn-save:active {
            transform: translateY(0);
        }

        /* Marker Selection Glow Effect */
        .dev-selected-marker {
            filter: drop-shadow(0 0 10px #daac71) drop-shadow(0 0 20px #daac71) !important;
            transform: scale(1.3) !important;
            z-index: 1000 !important;
            transition: all 0.3s ease;
        }

        .dev-modified-marker {
            filter: drop-shadow(0 0 8px #4ade80) !important;
        }

        /* Drag and Drop Zone */
        .dev-drop-zone {
            border: 2px dashed rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            background: rgba(0, 0, 0, 0.2);
            position: relative;
            min-height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .dev-drop-zone:hover {
            border-color: #daac71;
            background: rgba(218, 172, 113, 0.05);
        }

        .dev-drop-zone.dragover {
            border-color: #daac71;
            background: rgba(218, 172, 113, 0.1);
            transform: scale(0.99);
        }
        
        .dev-drop-message {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 13px;
            pointer-events: none;
        }

        .dev-drop-preview {
            display: none;
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            border-radius: 6px;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }
        
        .dev-drop-preview.active {
            display: block;
        }
        
        .dev-drop-remove {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.2);
            z-index: 10;
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
export const setMode = (mode) => {
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

    // Ensure listeners are bound when any mode is active (for Community Toolbar compatibility)
    if (mode) {
      ensureDevListenersBound();
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
  // Pixi 스프라이트 선택 효과 초기화
  if (devState._selectedSprite) {
    devState._selectedSprite.tint = devState._selectedSpriteOrigTint ?? 0xFFFFFF;
    devState._selectedSprite.scale.set(
      devState._selectedSpriteOrigScale?.x ?? 1,
      devState._selectedSpriteOrigScale?.y ?? 1,
    );
    import("./map/pixiOverlay/overlayCore.js").then(({ redrawPixiOverlay }) => {
      redrawPixiOverlay();
    });
    devState._selectedSprite = null;
  }
  devState.selectedMarker = null;
  devState.selectedMarkerData = null;
  updateUI();
};

/**
 * 마커 클릭 핸들러 (CPU 모드 Leaflet 마커용)
 */
const handleMarkerClick = (e) => {
  // 추가 모드일 때는 마커 클릭 무시
  if (devState.currentMode === "add") {
    if (e.originalEvent) {
      e.originalEvent.stopPropagation();
      e.originalEvent.preventDefault();
    }
    return;
  }

  const isCommunityToolActive = !!(devState.currentMode || devState.isDeleteMode);
  if (!devState.isActive && !isCommunityToolActive) return;

  const marker = e.target;
  const markerData = Array.from(state.allMarkers.values()).find(
    (m) => m.marker === marker,
  );

  if (!markerData) return;

  marker.closePopup();

  if (handleMarkerAction(markerData, marker)) {
    if (e.originalEvent) {
      e.originalEvent.stopPropagation();
      e.originalEvent.preventDefault();
    }
  }
};

/**
 * GPU 모드 마커 클릭 핸들러 (ID 기반)
 */
const handleGpuMarkerClick = (markerId) => {
  // Check if any mode is active (permitting Community Toolbar use)
  if (!devState.currentMode && !devState.isDeleteMode) return false;

  const markerData =
    state.allMarkers.get(markerId) || state.allMarkers.get(String(markerId));
  if (!markerData) return false;

  if (state.map && state.map._popup) {
    state.map.closePopup();
  }

  // Set a temporary flag to ignore the next map click in the same event loop
  devState._lastMarkerClickTime = Date.now();

  return handleMarkerAction(markerData, null);
};

/**
 * 마커 액션 처리 (공통)
 */
const handleMarkerAction = (markerData, leafletMarker) => {
  if (devState.currentMode === "add") {
    // 추가 모드에서는 마커 클릭 시 아무 동작도 하지 않고 차단만 함
    return true;
  }

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

    // Pixi 스프라이트 선택 효과 (골드 하이라이트)
    import("./map/pixiOverlay/spriteFactory.js").then(({ getSpriteById }) => {
      const sprite = getSpriteById(markerData.id);
      if (sprite) {
        devState._selectedSprite = sprite;
        devState._selectedSpriteOrigTint = sprite.tint ?? 0xFFFFFF;
        devState._selectedSpriteOrigScale = { x: sprite.scale.x, y: sprite.scale.y };
        sprite.tint = 0xFFD700;
        sprite.scale.set(sprite.scale.x * 1.3, sprite.scale.y * 1.3);
        import("./map/pixiOverlay/overlayCore.js").then(({ redrawPixiOverlay }) => {
          redrawPixiOverlay();
        });
      }
    });

    addLog(`이동 대상 선택: ${markerData.originalName || markerData.id}`, "info");
    updateUI();
    return true;
  } else if (devState.isDeleteMode || devState.currentMode === "delete") {
    // 삭제 모드: 마커 클릭 시 즉시 glow 효과와 함께 삭제 사유 입력받음
    clearSelection();

    if (leafletMarker) {
      const icon = leafletMarker.getElement?.();
      if (icon) {
        icon.classList.add("dev-selected-marker");
      }
    }

    const reason = prompt(`[${markerData.originalName || markerData.id}] 마커를 삭제 제안하시겠습니까?\n이유를 입력해주세요:`);

    if (!reason || !reason.trim()) {
      if (leafletMarker) {
        const icon = leafletMarker.getElement?.();
        if (icon) icon.classList.remove("dev-selected-marker");
      }
      return true; // 취소해도 정보 모달이 뜨는 것을 방지하기 위해 true 반환
    }

    const isOfficial = !markerData.isBackend;

    import("./ui/wiki.js").then(async (wiki) => {
      const { getAuthToken } = await import("./auth.js");
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('target_marker_id', String(markerData.id));
      formData.append('is_official', String(isOfficial));
      formData.append('map_id', state.currentMapKey || 'qinghe');
      formData.append('deleted', 'true');
      formData.append('edit_reason', reason.trim());
      formData.append('status', 'pending');

      try {
        const res = await fetch(`${BACKEND_URL}/api/revisions`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const result = await res.json();
        if (result.success) {
          alert("삭제 제안이 제출되었습니다.");
          addLog(`삭제 제안 완료: ${markerData.originalName || markerData.id}`, "success");
        } else {
          alert("제출 실패: " + (result.error || "알 수 없는 오류"));
        }
      } catch (e) {
        alert("서버 연결 실패");
      }

      if (leafletMarker) {
        const icon = leafletMarker.getElement?.();
        if (icon) icon.classList.remove("dev-selected-marker");
      }
      clearSelection();
    });

    return true;
  }
  return false;
};

/**
 * 마커 이동 확인 오버레이 표시 (prompt() 대체)
 */
const showMoveConfirmOverlay = (lat, lng, markerData, onConfirm, onCancel) => {
  const previewIcon = /** @type {any} */ (L).divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:rgba(255,215,0,0.5);border:2px solid #FFD700;box-shadow:0 0 10px rgba(255,215,0,0.9);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  const previewMarker = /** @type {any} */ (L).marker([parseFloat(lat), parseFloat(lng)], { icon: previewIcon }).addTo(state.map);

  const overlay = document.createElement('div');
  overlay.id = 'move-confirm-overlay';
  overlay.style.cssText = [
    'position:fixed', 'bottom:100px', 'left:50%', 'transform:translateX(-50%)',
    'background:#1a1a2e', 'border:1px solid #FFD700', 'border-radius:8px',
    'padding:12px 16px', 'z-index:9999', 'color:#fff', 'font-size:13px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.6)', 'display:flex',
    'flex-direction:column', 'gap:8px', 'min-width:280px', 'max-width:380px',
  ].join(';');
  overlay.innerHTML = `
    <div style="font-weight:600;color:#FFD700;">[${markerData.title || markerData.name}] 위치 이동 제안</div>
    <div style="color:#aaa;font-size:11px;">→ ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}</div>
    <input id="move-reason-input" placeholder="이유 (선택 사항)" style="background:#0d0d1a;border:1px solid #555;border-radius:4px;padding:6px 8px;color:#fff;font-size:12px;outline:none;"/>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button id="move-cancel-btn" style="background:transparent;border:1px solid #888;border-radius:4px;color:#aaa;padding:5px 12px;cursor:pointer;font-size:12px;">취소</button>
      <button id="move-confirm-btn" style="background:#FFD700;border:none;border-radius:4px;color:#111;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:600;">이동 제안</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const cleanup = () => {
    previewMarker.remove();
    overlay.remove();
  };

  document.getElementById('move-confirm-btn').onclick = () => {
    const reason = /** @type {HTMLInputElement} */ (document.getElementById('move-reason-input')).value.trim() || '위치 조정';
    cleanup();
    onConfirm(reason);
  };
  document.getElementById('move-cancel-btn').onclick = () => {
    cleanup();
    onCancel();
  };
};

/**
 * 맵 클릭 핸들러
 */
const handleMapClick = (e) => {
  // Avoid processing map click if it was already handled by a marker click in this same event loop
  if (devState._lastMarkerClickTime && Date.now() - devState._lastMarkerClickTime < 50) {
    return;
  }

  const isCommunityToolActive = !!(devState.currentMode || devState.isDeleteMode);
  if (!devState.isActive && !isCommunityToolActive) return;

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

    // [COMMUNITY MODE INTEGRATION]
    // If community mode is enabled, propose a move revision instead of direct local edit
    if (state.showCommunityMarkers) {
      // 이미 오버레이가 열려있으면 무시
      if (document.getElementById('move-confirm-overlay')) return;

      showMoveConfirmOverlay(lat, lng, markerData, (reason) => {
        const isOfficial = !markerData.isBackend;
        import("./ui/wiki.js").then(async (wiki) => {
          const { getAuthToken } = await import("./auth.js");
          const token = await getAuthToken();
          const formData = new FormData();
          formData.append('target_marker_id', String(markerData.id));
          formData.append('is_official', String(isOfficial));
          formData.append('map_id', state.currentMapKey || 'qinghe');
          formData.append('lat', String(lat));
          formData.append('lng', String(lng));
          formData.append('edit_reason', reason);
          formData.append('status', 'approved');
          try {
            const res = await fetch(`${BACKEND_URL}/api/revisions`, {
              method: 'POST',
              credentials: 'include',
              body: formData,
              headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const result = await res.json();
            if (result.success) {
              addLog(`위치 변경 승인됨: ${markerData.title || markerData.id}`, "success");
              // 즉시 로컬 상태 업데이트
              if (markerData.isBackend) {
                const cm = state.communityMarkers.get(String(markerData.id));
                if (cm) {
                  cm.lat = parseFloat(lat);
                  cm.lng = parseFloat(lng);
                }
              }
              import("./sync/ui.js").then(({ showSyncToast }) => {
                showSyncToast("위치가 변경되었습니다!", "success");
              });
            } else {
              alert("제출 실패: " + (result.error || "알 수 없는 오류"));
            }
          } catch (e) {
            alert("서버 연결 실패");
          }
          clearSelection();
        });
      }, () => {
        // 취소 — 선택 상태 유지 (재선택 가능)
      });
      return;
    }

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

    // Update the markerData reference
    markerData.lat = parseFloat(lat);
    markerData.lng = parseFloat(lng);

    // Also update the original item in state.mapData.items
    if (state.mapData?.items) {
      const originalItem = state.mapData.items.find(
        (item) => String(item.id) === String(markerData.id)
      );
      if (originalItem) {
        originalItem.x = lat; // latitude is stored as 'x' in the data
        originalItem.y = lng; // longitude is stored as 'y' in the data
      }
    }

    // For GPU mode, directly update sprite position and redraw
    if (state.gpuRenderMode) {
      import("./map/pixiOverlay/overlayCore.js").then((pixiModule) => {
        const pixiContainer = pixiModule.getPixiContainer();
        const pixiOverlay = pixiModule.getPixiOverlay();

        if (pixiContainer && pixiOverlay) {
          // Find the sprite for this marker and update its position
          const sprite = pixiContainer.children.find(
            (s) =>
              s.markerData &&
              String(s.markerData.item?.id || s.markerData.id) === String(markerData.id)
          );

          if (sprite) {
            // Update sprite's markerData
            sprite.markerData.lat = parseFloat(lat);
            sprite.markerData.lng = parseFloat(lng);
            if (sprite.markerData.item) {
              sprite.markerData.item.x = lat;
              sprite.markerData.item.y = lng;
            }
          }

          // Force redraw the overlay
          pixiOverlay.redraw();
        }
      });
    }

    devState.changes.set(markerData.id, {
      id: markerData.id,
      name: markerData.originalName,
      category: markerData.category,
      original: devState.originalPositions.get(markerData.id),
      modified: { lat: parseFloat(lat), lng: parseFloat(lng) },
    });

    const icon = devState.selectedMarker?.getElement?.();
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

  let clipboardText = csvOutput;
  let copyMessage = `${changesArray.length}개 마커 수정사항(translation.csv용) 복사됨`;

  if (devState.newMarkers.length > 0) {
    const newMarkersCsv = devState.newMarkers
      .map((m) => {
        // Match data3.csv format: id,category_id,title,description,latitude,longitude,region
        const id = m.id;
        const catId = m.category_id || m.type;
        const title = m.title.includes(",") ? `"${m.title}"` : m.title;
        const desc = m.description ? `"${m.description.replace(/"/g, '""')}"` : '""';
        const lat = typeof m.latitude === "number" ? m.latitude.toFixed(6) : m.latitude;
        const lng = typeof m.longitude === "number" ? m.longitude.toFixed(6) : m.longitude;
        const region = m.region || "";

        return `${id},${catId},${title},${desc},${lat},${lng},${region}`;
      })
      .join("\n");

    const currentMap = state.currentMapKey === "qinghe" ? "data3.csv" : "data4.csv";
    console.log(`%c📋 신규 마커 목록 (${currentMap}용)`, "color: #daac71; font-size: 16px; font-weight: bold;");
    console.log("id,category_id,title,description,latitude,longitude,regionId,image,video_url");
    console.log(newMarkersCsv);

    clipboardText = newMarkersCsv;
    copyMessage = `${devState.newMarkers.length}개 신규 마커(data3/4.csv용) 복사됨`;
  }

  navigator.clipboard.writeText(clipboardText).then(() => {
    addLog(copyMessage, "success");
  });

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
  devState.newMarkers = [];
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
    .getElementById("dev-btn-test-dup")
    ?.addEventListener("click", () => simulateDuplicates());

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
 * 전역 리스너 보장 (맵 클릭 등)
 * Community Toolbar 등으로 진입 시에도 이벤트가 작동하도록 함
 */
export const ensureDevListenersBound = () => {
  if (!state.map) return;

  // 맵 이벤트 (중복 방지를 위해 off 후 on)
  state.map.off("click", handleMapClick);
  state.map.off("mousemove", handleMouseMove);

  if (devState.isActive || devState.currentMode || devState.isDeleteMode) {
    state.map.on("click", handleMapClick);
    state.map.on("mousemove", handleMouseMove);
  }

  // 마커 이벤트
  attachMarkerListeners();
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
    ensureDevListenersBound();
  }

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
    ensureDevListenersBound();
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
// @ts-ignore
window.devState = devState;

/**
 * 전용 툴바를 위한 모드 설정 래퍼
 * @param {string|null} mode
 */
export const setDevMode = (mode) => {
  if (mode === 'delete') {
    devState.isDeleteMode = true;
    setMode(null);
  } else {
    devState.isDeleteMode = false;
    setMode(mode);
  }

  // Ensure listeners are bound immediately
  ensureDevListenersBound();
};

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
  devState.currentPolygon = /** @type {any} */ (L).polygon([], {
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

  const handle = /** @type {any} */ (L).marker(latlng, {
    draggable: true,
    icon: /** @type {any} */ (L).divIcon({
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

  devState.currentPolygon = /** @type {any} */ (L).polygon(latlngs, {
    color: "#4444ff",
    weight: 3,
  }).addTo(state.map);

  latlngs.forEach((ll) => {
    const handle = /** @type {any} */ (L).marker(ll, {
      draggable: true,
      icon: /** @type {any} */ (L).divIcon({
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

export const openAddMarkerModal = (lat, lng) => {
  // Ensure dev mode is properly initialized if not active
  if (!devState.isActive) {
    startDev();
  }

  // Hide the main dev tools panel as requested
  const devPanel = document.getElementById("dev-tools-modal");
  if (devPanel) devPanel.style.display = "none";

  createAddMarkerModal(lat, lng);
};

/**
 * 시뮬레이션: 현재 지도 중심에 중복 마커(근처 위치)들을 생성하여 로직 확인
 */
const simulateDuplicates = async () => {
  if (!state.map) return;

  // 1. Community Mode 강제 활성화 (마커가 보이도록 필수 설정)
  if (!state.showCommunityMarkers) {
    setState("showCommunityMarkers", true);
    const communityToggle = document.getElementById("community-mode-toggle");
    if (communityToggle && communityToggle instanceof HTMLInputElement) {
      communityToggle.checked = true;
    }
  }

  const center = state.map.getCenter();
  const category = "17310010001"; // 보물상자

  // 5개의 가상 마커 생성
  // i=1~3: 거의 동일 위치 (통합 테스트용)
  // i=4~5: 근처 위치 (개별 표시 테스트용)
  for (let i = 1; i <= 5; i++) {
    const latOffset = (i <= 3) ? (i * 0.00001) : (i * 0.003 + (Math.random() * 0.001));
    const lngOffset = (i <= 3) ? (i * 0.00001) : (i * 0.003 + (Math.random() * 0.001));
    const fakeId = `SIM-${Date.now()}-${i}`;

    const fakeMarker = {
      id: fakeId,
      name: `시뮬레이션 마커 ${i}`,
      description: `이것은 테스트용 제보 ${i}입니다. ${i === 1 ? '가장 추천이 많아 대표로 표시됩니다.' : ''}`,
      category: category,
      lat: center.lat + latOffset,
      lng: center.lng + lngOffset,
      x: center.lat + latOffset, // Supercluster compatibility
      y: center.lng + lngOffset, // Supercluster compatibility
      isBackend: true,
      status: 'approved',
      votes: { up: i === 1 ? 99 : Math.floor(Math.random() * 10), down: 0 },
      images: [],
      video_url: [],
      user_id: `tester_${i}`
    };

    state.communityMarkers.set(fakeId, fakeMarker);
  }

  import("./sync/ui.js").then(({ showSyncToast }) => {
    showSyncToast("5개의 테스트 마커가 생성되었습니다.", "success");
  });

  // 2. 렌더링 강제 업데이트
  const { renderMapDataAndMarkers } = await import("./map/markers.js");
  renderMapDataAndMarkers();
};

dev.simulateDuplicates = simulateDuplicates;
dev.handleGpuClick = handleGpuMarkerClick;

export { dev, startDev, stopDev };

// Clean up temp marker when modal is closed
export const closeAddMarkerModal = () => {
  const modal = document.getElementById("dev-add-marker-modal");
  if (modal) {
    modal.style.display = "none";
  }
  if (devState.tempMarker) {
    if (state.map) state.map.removeLayer(devState.tempMarker);
    devState.tempMarker = null;
  }
};
