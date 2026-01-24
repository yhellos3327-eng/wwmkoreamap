// @ts-check
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

  if (settings.regionColor !== undefined) {
    setState("savedRegionColor", settings.regionColor);
  }
  if (settings.regionFillColor !== undefined) {
    setState("savedRegionFillColor", settings.regionFillColor);
  }

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

  if (cloudData.completedMarkers) {
    let markers = cloudData.completedMarkers;

    if (markers.length > 0 && typeof markers[0] !== "object") {
      markers = markers.map((id) => ({ id, completedAt: null }));
    }
    setState("completedList", markers);
    // localStorage에도 저장하여 새로고침 시에도 유지되도록 함
    localStorage.setItem("wwm_completed", JSON.stringify(markers));
    console.log(
      "[SyncHandler] State and localStorage updated:",
      localStorage.getItem("wwm_completed"),
    );
  }

  if (cloudData.favorites) {
    setState("favorites", cloudData.favorites);
    // localStorage에도 저장하여 새로고침 시에도 유지되도록 함
    localStorage.setItem("wwm_favorites", JSON.stringify(cloudData.favorites));
  }

  if (cloudData.settings) {
    applyCloudSettings(cloudData.settings);
  }

  renderMapDataAndMarkers();
  renderFavorites();

  const settingsModal = document.getElementById("settings-modal");
  if (settingsModal && !settingsModal.classList.contains("hidden")) {
    import("./settings.js").then((m) => m.initSettingsModal());
  }

  // [Vault] 동기화 성공 시 백업 (중요 체크포인트)
  import("./storage/vault.js").then(({ saveToVault }) => {
    saveToVault("sync_success");
  });
};

/**
 * 클라우드 동기화 이벤트 리스너 초기화
 */
export const initSyncHandler = () => {
  window.addEventListener("syncDataLoaded", (e) => {
    applySyncData(/** @type {CustomEvent} */(e).detail);
  });
};
