/**
 * 클라우드 동기화 데이터 처리 모듈
 * - Firebase 동기화 데이터를 앱 상태에 반영
 */
import { state, setState } from "./state.js";
import { renderMapDataAndMarkers } from "./map.js";
import { renderFavorites } from "./ui.js";

/**
 * 클라우드에서 로드된 설정을 앱 상태에 반영
 * @param {Object} settings - 클라우드 설정 객체
 */
const applyCloudSettings = (settings) => {
  if (!settings) return;

  const booleanSettings = [
    { key: "showComments", stateKey: "showComments" },
    { key: "closeOnComplete", stateKey: "closeOnComplete" },
    { key: "hideCompleted", stateKey: "hideCompleted" },
    { key: "enableClustering", stateKey: "enableClustering" },
  ];

  booleanSettings.forEach(({ key, stateKey }) => {
    if (settings[key] !== undefined) {
      setState(stateKey, settings[key] === "true" || settings[key] === true);
    }
  });

  // 색상 설정
  if (settings.regionColor !== undefined) {
    setState("savedRegionColor", settings.regionColor);
  }
  if (settings.regionFillColor !== undefined) {
    setState("savedRegionFillColor", settings.regionFillColor);
  }

  // GPU 모드 설정
  if (settings.gpuMode !== undefined) {
    let gpuSetting = settings.gpuMode;
    if (gpuSetting === "true" || gpuSetting === true) gpuSetting = "on";
    else if (gpuSetting === "false" || gpuSetting === false) gpuSetting = "off";

    if (["on", "off", "auto"].includes(gpuSetting)) {
      state.savedGpuSetting = gpuSetting;
      localStorage.setItem("wwm_gpu_setting", gpuSetting);
    }
  }
};

/**
 * 클라우드 동기화 데이터를 앱 상태에 반영
 * @param {Object} cloudData - 클라우드에서 로드된 데이터
 */
export const applySyncData = (cloudData) => {
  if (!cloudData) return;

  console.log("[SyncHandler] Sync data loaded, updating state...", cloudData);

  // 완료 마커 동기화
  if (cloudData.completedMarkers) {
    let markers = cloudData.completedMarkers;
    // 레거시 포맷 마이그레이션 (ID만 있는 경우 → 객체 형태로)
    if (markers.length > 0 && typeof markers[0] !== "object") {
      markers = markers.map((id) => ({ id, completedAt: null }));
    }
    setState("completedList", markers);
    console.log(
      "[SyncHandler] State updated. LocalStorage check:",
      localStorage.getItem("wwm_completed"),
    );
  }

  // 즐겨찾기 동기화
  if (cloudData.favorites) {
    setState("favorites", cloudData.favorites);
  }

  // 설정 동기화
  if (cloudData.settings) {
    applyCloudSettings(cloudData.settings);
  }

  // UI 갱신
  renderMapDataAndMarkers();
  renderFavorites();

  // 설정 모달이 열려있으면 갱신
  const settingsModal = document.getElementById("settings-modal");
  if (settingsModal && !settingsModal.classList.contains("hidden")) {
    import("./settings.js").then((m) => m.initSettingsModal());
  }
};

/**
 * 클라우드 동기화 이벤트 리스너 초기화
 */
export const initSyncHandler = () => {
  window.addEventListener("syncDataLoaded", (e) => {
    applySyncData(e.detail);
  });
};
