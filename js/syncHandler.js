// @ts-check
/**
 * 클라우드 동기화 데이터 처리 모듈
 * DEXIE.JS MIGRATION: Vault (IndexedDB) as single source of truth
 */
import { state, setState } from "./state.js";
import { renderMapDataAndMarkers } from "./map.js";
import { renderFavorites } from "./ui.js";
import { primaryDb } from "./storage/db.js";
import { createLogger } from "./utils/logStyles.js";

const log = createLogger("SyncHandler");

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
      primaryDb.set("wwm_gpu_setting", gpuSetting).catch(console.warn);
    }
  }
};

/**
 * 클라우드 동기화 데이터를 앱 상태에 반영
 * @param {Object} cloudData - 클라우드에서 로드된 데이터
 */
export const applySyncData = (cloudData) => {
  if (!cloudData) return;

  log.sync("클라우드 데이터 수신", {
    completed: cloudData.completedMarkers?.length || 0,
    favorites: cloudData.favorites?.length || 0,
  });

  if (cloudData.completedMarkers) {
    let markers = cloudData.completedMarkers;

    if (markers.length > 0 && typeof markers[0] !== "object") {
      markers = markers.map((id) => ({ id, completedAt: null }));
    }
    setState("completedList", markers);

    // Save to Vault (primary database) - ALWAYS for all users
    primaryDb.set("completedList", markers).then(() => {
      log.vault(`completedList 저장`, markers.length);
    }).catch(console.warn);


  }

  if (cloudData.favorites) {
    setState("favorites", cloudData.favorites);

    // Save to Vault (primary database) - ALWAYS for all users
    primaryDb.set("favorites", cloudData.favorites)
      .then(() => {
        log.vault(`favorites 저장`, cloudData.favorites.length);
      })
      .catch((error) => {
        log.error("favorites 저장 실패", error);
      });


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
