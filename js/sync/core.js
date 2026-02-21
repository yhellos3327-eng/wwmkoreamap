// @ts-check
/**
 * 동기화 코어 모듈 - 로컬과 클라우드 간의 데이터 동기화를 처리합니다.
 * @module sync/core
 */

import {
  getSyncState,
  setSyncing,
  setLastSyncVersion,
  getSyncTimeout,
  setSyncTimeout,
  getPollingInterval,
  setPollingInterval,
  setInitialSyncComplete,
  setServerDataVersion,
  SYNC_DELAY,
  POLLING_INTERVAL,
} from "./state.js";
import { showSyncTooltip, hideSyncTooltip, showSyncToast, showDataLossWarning } from "./ui.js";
import { getLocalData, setLocalData, getLocalDataAsync } from "./storage.js";
import { primaryDb } from "../storage/db.js";
import { isMigrated } from "../storage/migration.js";
import { mergeData, generateDataHash } from "./merge.js";
import { fetchCloudData, saveCloudData, saveCloudBackup } from "./api.js";
import {
  initBroadcastChannel,
  broadcastSyncUpdate,
  closeBroadcastChannel,
} from "./broadcast.js";
import {
  connectWebSocket,
  sendSyncUpdate,
  disconnectWebSocket,
  isWebSocketConnected,
} from "./websocket.js";
import { createLogger } from "../utils/logStyles.js";

const log = createLogger("Sync");

/** @type {any} */
let authModule = null;

/**
 * 인증 모듈을 가져옵니다.
 * @returns {Promise<any>} 인증 모듈.
 */
const getAuth = async () => {
  if (!authModule) authModule = await import("../auth.js");
  return authModule;
};

/**
 * 사용자가 로그인했는지 확인합니다.
 * @returns {boolean} 로그인 여부.
 */
const isLoggedIn = () => authModule?.isLoggedIn?.() ?? false;

/**
 * 현재 사용자 ID를 가져옵니다.
 * @returns {string|null} 사용자 ID 또는 null.
 */
const getUserId = () => authModule?.getCurrentUser?.()?.id ?? null;

/**
 * 데이터를 UI 및 로컬 저장소에 적용합니다.
 * @param {any} data - 적용할 데이터.
 * @param {string} [source='internal'] - 데이터 소스 ('internal' 또는 'external').
 */
const applyDataToUI = (data, source = 'internal') => {
  setLocalData(data);
  window.dispatchEvent(new CustomEvent("syncDataLoaded", { detail: { ...data, _source: source } }));
};

/**
 * 데이터를 클라우드에 저장합니다.
 * @param {boolean} [silent=false] - UI 피드백 억제 여부.
 * @param {boolean} [broadcast=true] - 업데이트 방송 여부.
 * @param {boolean} [force=false] - 가드 설정을 무시하고 강제 저장 여부.
 * @returns {Promise<boolean>} 저장 성공 여부.
 */
export const saveToCloud = async (silent = false, broadcast = true, force = false) => {
  if (!isLoggedIn()) return false;
  if (getSyncState().isSyncing) return false;

  // 가드 1: 초기 동기화 완료 필요
  if (!getSyncState().isInitialSyncComplete && !force) {
    log.warn("차단됨: 초기 동기화 미완료. 저장이 취소되었습니다.");
    if (!silent) showSyncToast("초기 동기화 전에는 저장할 수 없습니다.", "error");
    return false;
  }

  // SAFETY FIX: Optimistic locking - capture version at start
  const currentSyncVersion = syncVersion;

  setSyncing(true);
  if (!silent) showSyncTooltip("동기화중...");

  // [방지] 클라우드 전송 전 로컬 백업 저장
  try {
    const { saveToVault } = await import("../storage/vault.js");
    await saveToVault("pre_cloud_save");
  } catch (e) {
    log.warn("사전 저장 백업 실패", e);
  }

  try {
    // 마이그레이션된 사용자는 Vault에서 데이터를 가져오기 위해 비동기 버전 사용
    let data;
    try {
      data = await getLocalDataAsync();
    } catch (e) {
      log.error("동기화를 위한 로컬 데이터 획득 실패", e);
      throw e;
    }

    // 안전 가드: 데이터가 있었는데 빈 데이터를 동기화하는 것을 방지
    const prevCompletedCount = await primaryDb.get("sync_safety_prev_count");
    const currentCompletedCount = data.completedMarkers?.length || 0;

    if (prevCompletedCount !== null && prevCompletedCount !== undefined && prevCompletedCount > 0 && currentCompletedCount === 0 && !force) {
      log.warn("안전 가드: 채워진 클라우드 데이터를 빈 데이터로 덮어쓰는 것을 차단함");
      if (!silent) showSyncToast("데이터 유실 방지: 빈 데이터 동기화가 차단되었습니다.", "error");
      return false;
    }

    // 가드 2: 대규모 데이터 유실 방지
    // 덮어쓰기 전 클라우드 개수 확인
    try {
      const cloudResult = await fetchCloudData();
      const cloudDataSnapshot = cloudResult.data;
      const cloudCount = (cloudDataSnapshot?.completedMarkers?.length || 0) + (cloudDataSnapshot?.favorites?.length || 0);
      const localCount = (data.completedMarkers?.length || 0) + (data.favorites?.length || 0);
      const threshold = 10; // Allow small variations

      // 클라우드 데이터가 로컬보다 상당히 많고 강제 저장이 아닌 경우
      if (cloudCount > localCount + threshold && !force) {
        log.error(`차단됨: 대규모 데이터 유실 보호. 클라우드: ${cloudCount}, 로컬: ${localCount}`);
        if (!silent) showSyncToast(`서버 데이터(${cloudCount}개)가 더 많아 덮어쓰기가 차단되었습니다.`, "error");

        // Trigger a re-sync instead
        log.info("충돌 해결을 위해 재동기화 시도 중...");
        performFullSync(false, true);
        return false;
      }
    } catch (e) {
      log.warn("클라우드 데이터 개수 확인 실패, 주의하며 진행", e);
    }

    // 다음 확인을 위한 개수 업데이트
    if (currentCompletedCount > 0) {
      primaryDb.set("sync_safety_prev_count", currentCompletedCount).catch(console.warn);
    }

    // 안전 조치: 클라우드 전송 전 Vault(주 데이터베이스)에도 저장
    try {
      const { primaryDb } = await import("../storage/db.js");
      await primaryDb.setMultiple([
        { key: "completedList", value: data.completedMarkers },
        { key: "favorites", value: data.favorites },
        { key: "settings", value: data.settings }
      ]);
    } catch (e) {
      log.warn("클라우드 전 Vault 저장 실패", e);
    }

    // 레이스 컨디션 확인
    if (syncVersion !== currentSyncVersion) {
      log.warn("Race condition detected before save, aborting");
      if (!silent) showSyncToast("동기화 충돌: 다시 시도해주세요.", "error");
      return false;
    }

    // 낙관적 잠금: 예상 버전 전송
    const expectedVersion = getSyncState().serverDataVersion;
    const saveResult = await saveCloudData(data, expectedVersion);

    // 성공 시 로컬 버전 추적 업데이트
    if (saveResult.version) {
      setServerDataVersion(saveResult.version);
    }

    setLastSyncVersion(generateDataHash(data));

    if (broadcast) {
      broadcastSyncUpdate(data);
      sendSyncUpdate(data);
    }

    if (!silent) {
      showSyncTooltip("동기화 완료!", "success");
      hideSyncTooltip(1500);
    }

    // Update Base Snapshot
    primaryDb.set("sync_base_snapshot", data).catch(console.warn);

    // 자동 백업 (정기적 클라우드 스냅샷)
    try {
      const lastBackup = await primaryDb.get("last_auto_cloud_backup");
      // 간격: 1시간
      if (!lastBackup || Date.now() - lastBackup > 1000 * 60 * 60) {
        // 백그라운드에서 실행, 차단 대기하지 않음
        saveCloudBackup("Auto Save", data)
          .then(() => {
            primaryDb.set("last_auto_cloud_backup", Date.now());
            log.info("자동 클라우드 백업 생성됨");
          })
          .catch(e => log.warn("자동 클라우드 백업 실패", e));
      }
    } catch (e) {
      console.warn("자동 백업 확인 실패", e);
    }

    return true;
  } catch (error) {
    // 버전 충돌 처리
    if (error.name === "VersionConflictError") {
      log.warn("낙관적 잠금: 버전 충돌 감지됨", error);
      if (!silent) showSyncToast("다른 기기에서 변경사항이 감지되었습니다. 병합 중...", "warning");

      // 자동 해결: 전체 동기화(병합) 트리거
      // timeoutPromise가 정의되어 있거나 어디선가 사용 가능하다고 가정
      const timeoutPromise = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      timeoutPromise(100).then(() => performFullSync(silent, broadcast));
      return false;
    }

    log.error("저장 실패", error);
    if (!silent) {
      showSyncTooltip("동기화 실패", "error");
      hideSyncTooltip(2000);
    }
    return false;
  } finally {
    setSyncing(false);
  }
};

/**
 * 클라우드에서 데이터를 불러옵니다.
 * @param {boolean} [silent=false] - UI 피드백 억제 여부.
 * @returns {Promise<any|null>} 클라우드 데이터 또는 null.
 */
export const loadFromCloud = async (silent = false) => {
  if (!isLoggedIn()) return null;
  if (!silent) showSyncTooltip("데이터 불러오는 중...");

  try {
    const { data: cloudData, version } = await fetchCloudData();

    // 버전 추적
    setServerDataVersion(version);

    if (cloudData) {
      if (!silent) {
        showSyncTooltip("데이터 불러오기 완료!", "success");
        hideSyncTooltip(1500);
      }
      // 베이스 스냅샷 업데이트
      primaryDb.set("sync_base_snapshot", cloudData).catch(console.warn);
      return cloudData;
    }
    if (!silent) hideSyncTooltip(0);
    return null;
  } catch (error) {
    log.error("불러오기 실패", error);
    if (!silent) {
      showSyncTooltip("불러오기 실패", "error");
      hideSyncTooltip(2000);
    }
    return null;
  }
};

/** @type {number} 낙관적 잠금을 위한 동기화 락 버전 */
let syncVersion = 0;

/**
 * 전체 동기화를 실행합니다 (로컬 및 클라우드 데이터 병합).
 * 안전 가드: 레이스 컨디션을 방지하기 위해 낙관적 잠금을 추가함.
 * @param {boolean} [silent=false] - UI 피드백 억제 여부.
 * @param {boolean} [broadcast=true] - 업데이트 방송 여부.
 * @returns {Promise<any|null>} 병합된 데이터 또는 null.
 */
export const performFullSync = async (silent = false, broadcast = true) => {
  if (!isLoggedIn()) return null;
  if (getSyncState().isSyncing) return null;

  // SAFETY FIX: Optimistic locking - capture version at start
  const currentSyncVersion = ++syncVersion;

  setSyncing(true);

  // [방지] 전체 동기화 전 로컬 백업 저장
  let preBackupId = null;
  try {
    const { saveToVault } = await import("../storage/vault.js");
    const result = await saveToVault("pre_full_sync");
    preBackupId = result.id;
  } catch (e) {
    log.warn("사전 동기화 백업 실패", e);
  }

  try {
    const { data: cloudData, version } = await fetchCloudData();

    // 서버 버전 캡처
    if (version) {
      setServerDataVersion(version);
    }

    // 안전 조치: 데이터를 가져오는 동안 다른 동기화가 시작되었는지 확인
    if (syncVersion !== currentSyncVersion) {
      log.warn("레이스 컨디션 감지, 이 동기화 중단됨");
      return null;
    }

    // Use async version for migrated users to get data from Vault
    let localData;
    try {
      localData = await getLocalDataAsync();
    } catch (e) {
      log.error("전체 동기화를 위한 로컬 데이터 획득 실패", e);
      return null;
    }

    // 3-Way 병합을 위한 베이스 스냅샷 불러오기
    let baseData = {};
    try {
      baseData = (await primaryDb.get("sync_base_snapshot")) || {};
    } catch (e) {
      log.warn("베이스 스냅샷 불러오기 실패, 기본값(빈 객체) 사용", e);
    }

    // 수정: 베이스가 비어있는 경우 (첫 실행), 클라우드를 베이스로 처리.
    // 이를 통해 3-Way 병합이 "로컬 삭제"를 올바르게 식별할 수 있습니다.
    // (베이스가 비어 있으면 !로컬 && 클라우드는 "새 원격 항목"이므로 다시 나타납니다.
    //  베이스 == 클라우드이면 !로컬 && 클라우드 && 베이스는 "로컬에서 삭제됨"이므로 삭제 상태를 유지합니다.)
    if ((!baseData.completedMarkers || baseData.completedMarkers.length === 0) && cloudData && cloudData.completedMarkers) {
      log.info("베이스 스냅샷이 없거나 비어 있음. 정확한 차분 병합을 위해 클라우드 데이터에서 베이스 초기화 중.");
      baseData = JSON.parse(JSON.stringify(cloudData));
    }

    // 안전 조치: 병합 전 데이터 유효성 검사
    const localCount = (localData.completedMarkers?.length || 0) + (localData.favorites?.length || 0);
    const cloudCount = (cloudData?.completedMarkers?.length || 0) + (cloudData?.favorites?.length || 0);
    const baseCount = (baseData.completedMarkers?.length || 0) + (baseData.favorites?.length || 0);

    // 가드: 갑작스러운 로컬 데이터 유실
    if (baseCount > 5 && localCount === 0 && cloudCount > 0) {
      log.warn("빈 로컬 상태를 통한 잠재적인 데이터 유실 감지됨.");

      if (silent) {
        // In silent mode (background), we play safe and abort
        log.warn("Background sync aborted to protect data.");
        return null;
      }

      // 사용자에게 확인
      const choice = await showDataLossWarning(localCount, cloudCount);

      if (choice === 'cancel') {
        return null;
      }

      if (choice === 'restore') {
        log.info("사용자가 클라우드에서 복구(RESTORE)를 선택함.");
        // 클라우드에서 강제 로드
        await loadFromCloud();
        return null;
      }

      log.info("사용자가 의도적인 삭제임을 확인했습니다. 병합을 진행합니다.");
    }

    log.info(`데이터 개수`, { local: localCount, cloud: cloudCount });

    if (cloudCount > localCount + 50) {
      log.info("클라우드 데이터가 상당히 더 많음. 클라우드 병합 우선순위 지정.");
    }

    // 3-Way 병합
    const mergedData = mergeData(localData, cloudData || {}, baseData);

    primaryDb.set("sync_base_snapshot", mergedData).catch(e => log.warn("스냅샷 업데이트 실패", e));

    const mergedCount = (mergedData.completedMarkers?.length || 0) + (mergedData.favorites?.length || 0);

    const unexpectedLoss = mergedCount < cloudCount * 0.8 && mergedCount < localCount * 0.8;

    const maxSourceCount = Math.max(localCount, cloudCount);

    if (maxSourceCount > 10 && mergedCount < maxSourceCount * 0.5 && mergedCount < cloudCount * 0.8) {
      log.error(`병합 결과 의심스러운 데이터 유실 발생`, { local: localCount, cloud: cloudCount, merged: mergedCount });

      let rollbackStatus = "백업 없음";
      if (preBackupId) {
        try {
          const { restoreFromVault } = await import("../storage/vault.js");
          await restoreFromVault(preBackupId);
          rollbackStatus = "성공";
        } catch (e) {
          log.error("롤백 실패", e);
          rollbackStatus = `실패 (${e.message})`;
        }
      }

      showSyncToast(
        `동기화 중단: 데이터 손실 위험 감지 (병합: ${mergedCount}, 로컬: ${localCount}, 클라우드: ${cloudCount}). 롤백: ${rollbackStatus}`,
        "error"
      );
      return null;
    }

    const newHash = generateDataHash(mergedData);
    const dataChanged = newHash !== getSyncState().lastSyncVersion;

    // 안전 조치: 변경사항을 적용하기 전 다시 레이스 컨디션 확인
    if (syncVersion !== currentSyncVersion) {
      log.warn("Race condition detected before save, aborting");
      return null;
    }

    const setResult = await setLocalData(mergedData);

    // 안전 조치: Vault(주 데이터베이스)에도 저장
    try {
      const { primaryDb } = await import("../storage/db.js");
      await primaryDb.setMultiple([
        { key: "completedList", value: mergedData.completedMarkers },
        { key: "favorites", value: mergedData.favorites },
        { key: "settings", value: mergedData.settings }
      ]);
    } catch (e) {
      log.warn("Vault 저장 실패", e);
    }

    if (dataChanged && !setResult?.blocked) {
      // 알림: 병합을 수행했으므로 클라우드 데이터를 덮어쓰는 것이 안전함.
      // 또한 낙관적 잠금을 위해 캡처된 서버 버전을 전달합니다.
      const saveResult = await saveCloudData(mergedData, version);
      if (saveResult && saveResult.version) {
        setServerDataVersion(saveResult.version);
      }

      setLastSyncVersion(newHash);
      window.dispatchEvent(
        new CustomEvent("syncDataLoaded", { detail: mergedData }),
      );

      if (broadcast) {
        // 데이터 유실 방지를 위해 버전이 지정된 페이로드 전송
        const payload = { ...mergedData, version: saveResult?.version };
        broadcastSyncUpdate(payload);
        sendSyncUpdate(payload);
      }

      if (!silent)
        showSyncToast("다른 기기의 변경사항이 동기화되었습니다", "update");
    }

    // 성공 표시: 초기 동기화 완료
    setInitialSyncComplete(true);

    return mergedData;
  } catch (error) {
    log.error("전체 동기화 실패", error);
    if (!silent) showSyncToast("동기화 실패: " + error.message, "error");
    return null;
  } finally {
    setSyncing(false);
  }
};

/**
 * 디바운스된 동기화를 트리거합니다.
 */
export const triggerSync = () => {
  if (!isLoggedIn()) return;
  const timeout = getSyncTimeout();
  if (timeout) clearTimeout(timeout);
  setSyncTimeout(setTimeout(() => saveToCloud(true), SYNC_DELAY));
};

/**
 * 타임스탬프 추적과 함께 설정을 업데이트합니다.
 * @param {string} key - 설정 키.
 * @param {any} value - 설정 값.
 */
export const updateSettingWithTimestamp = async (key, value) => {
  try {
    const settings = await primaryDb.get("settings") || {};
    settings[key] = value;
    const setResult = await primaryDb.set("settings", settings);
    if (!setResult || !setResult.success) {
      throw new Error(`설정 저장 실패: ${setResult?.error || '알 수 없는 오류'}`);
    }

    let timestamps = await primaryDb.get("settings_updated_at") || {};
    timestamps[key] = new Date().toISOString();
    const timeResult = await primaryDb.set("settings_updated_at", timestamps);
    if (!timeResult || !timeResult.success) {
      log.warn("설정 타임스탬프 저장 실패", timeResult?.error);
    }

    triggerSync();
  } catch (e) {
    log.error("설정 업데이트 실패", e);
  }
};

/**
 * 가시성 변경 이벤트를 처리합니다.
 */
const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") performFullSync(true);
};

/**
 * 창 포커스 이벤트를 처리합니다.
 */
const handleWindowFocus = () => {
  performFullSync(true);
};

/**
 * 동기화 업데이트를 위한 폴링을 시작합니다.
 */
const startPolling = () => {
  const existing = getPollingInterval();
  if (existing) clearInterval(existing);

  const interval = isWebSocketConnected()
    ? POLLING_INTERVAL * 3
    : POLLING_INTERVAL;

  setPollingInterval(
    setInterval(() => {
      if (document.visibilityState === "visible") performFullSync(true);
    }, interval),
  );
};

/**
 * 동기화 업데이트를 위한 폴링을 중단합니다.
 */
const stopPolling = () => {
  const interval = getPollingInterval();
  if (interval) {
    clearInterval(interval);
    setPollingInterval(null);
  }
};

/**
 * 원격 데이터 업데이트를 처리합니다.
 * @param {any} data - 원격 데이터.
 */
const handleRemoteData = (data) => {
  if (!data) return;

  // 가드: 충돌/덮어쓰기를 방지하기 위해 현재 동기화가 진행 중이면 외부 업데이트를 무시
  if (getSyncState().isSyncing) {
    log.info("동기화가 진행 중이므로 원격 업데이트를 무시합니다.");
    return;
  }

  // 가드: 버전 확인 (오래된 데이터 방지)
  // 들어오는 데이터가 우리가 가진 것보다 최신이 아니면 무시합니다.
  const currentVer = getSyncState().serverDataVersion;
  if (data.version && data.version <= currentVer) {
    // log.info(`오래된 원격 업데이트 무시 중 (v${data.version} <= v${currentVer})`);
    return;
  }

  const newHash = generateDataHash(data);

  // Ignore if this is the same version we just synced
  if (newHash === getSyncState().lastSyncVersion) return;

  const currentHash = generateDataHash(getLocalData());
  if (currentHash !== newHash) {
    applyDataToUI(data, 'external');
    setLastSyncVersion(newHash);

    // 서버 버전을 새 버전으로 업데이트
    if (data.version) setServerDataVersion(data.version);

    showSyncToast("다른 기기에서 변경사항이 동기화되었습니다", "update");
  }
};

/**
 * 브로드캐스트 데이터 업데이트를 처리합니다.
 * @param {any} data - 브로드캐스트 데이터.
 */
const handleBroadcastData = (data) => {
  if (!data) return;

  // 가드: 동기화가 진행 중이면 외부 업데이트 무시
  if (getSyncState().isSyncing) {
    log.info("동기화가 진행 중이므로 브로드캐스트 업데이트를 무시합니다.");
    return;
  }

  // 가드: 버전 확인
  const currentVer = getSyncState().serverDataVersion;
  if (data.version && data.version <= currentVer) {
    return;
  }

  const newHash = generateDataHash(data);

  // Ignore if this is the same version we just synced
  if (newHash === getSyncState().lastSyncVersion) return;

  const currentHash = generateDataHash(getLocalData());
  if (currentHash !== newHash) {
    applyDataToUI(data, 'external');
    setLastSyncVersion(newHash);
    if (data.version) setServerDataVersion(data.version);
    showSyncToast("다른 탭에서 변경사항이 동기화되었습니다", "update");
  }
};

/**
 * 실시간 동기화 리스너를 설정합니다.
 */
const setupRealtimeSync = () => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleWindowFocus);
  initBroadcastChannel(handleBroadcastData);

  const userId = getUserId();
  if (userId) connectWebSocket(userId, handleRemoteData);

  startPolling();
};

/**
 * 실시간 동기화 리스너를 정리합니다.
 */
export const cleanupRealtimeSync = () => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("focus", handleWindowFocus);
  closeBroadcastChannel();
  disconnectWebSocket();
  stopPolling();
};

/**
 * 동기화 시스템을 초기화합니다.
 * @returns {Promise<void>}
 */
export const initSync = async () => {
  await getAuth();

  // [방지] 동기화를 시작하기 전 로컬 저장소가 비어있으면 Vault에서 자동 복구
  try {
    const { autoRestoreIfEmpty } = await import("../storage/vault.js");
    const restoreResult = await autoRestoreIfEmpty();
    if (restoreResult.restored) {
      log.success("LocalStorage가 비어 있어 최신 Vault 백업에서 복원되었습니다.");
      showSyncToast("로컬 데이터가 비어있어 최신 백업에서 복구되었습니다.", "success");
    }
  } catch (e) {
    log.error("자동 복구 확인 실패", e);
  }

  if (!isLoggedIn()) return;

  const { primaryDb } = await import("../storage/db.js");
  const backupRestoredFlag = await primaryDb.get("wwm_backup_restored");
  if (backupRestoredFlag) {
    await primaryDb.delete("wwm_backup_restored");

    log.info("백업 복원 감지됨, 로컬 데이터를 클라우드로 전송 중...");
    showSyncTooltip("백업 데이터 동기화 중...");

    try {
      const saved = await saveToCloud(true, true);
      if (saved) {
        showSyncTooltip("백업 데이터 동기화 완료!", "success");
        hideSyncTooltip(1500);
      } else {
        showSyncTooltip("동기화 실패", "error");
        hideSyncTooltip(2000);
      }
    } catch (error) {
      log.error("백업 동기화 실패", error);
      showSyncTooltip("동기화 실패", "error");
      hideSyncTooltip(2000);
    }

    setupRealtimeSync();
    return;
  }

  showSyncTooltip("데이터 동기화 중...");

  try {
    const mergedData = await performFullSync(true, false);
    if (mergedData) {
      window.dispatchEvent(
        new CustomEvent("syncDataLoaded", { detail: mergedData }),
      );
      showSyncTooltip("동기화 완료!", "success");
      hideSyncTooltip(1500);
      setInitialSyncComplete(true);
    } else {
      hideSyncTooltip(0);
    }
    setupRealtimeSync();
  } catch (error) {
    log.error("초기화 실패", error);
    showSyncTooltip("동기화 실패", "error");
    hideSyncTooltip(2000);
  }
};

export { mergeData } from "./merge.js";
export { getLocalData, setLocalData } from "./storage.js";
