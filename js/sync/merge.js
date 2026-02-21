// @ts-check

/**
 * 마커 객체 또는 값에서 마커 ID를 가져옵니다.
 * @param {any} marker - 마커.
 * @returns {any} 마커 ID.
 */
export const getMarkerId = (marker) => {
  if (typeof marker === "object" && marker !== null) return marker.id;
  return marker;
};

/**
 * 마커를 일관된 객체 형식으로 정규화합니다.
 * @param {any[]} markers - 마커 배열.
 * @returns {Array<{id: any, completedAt: any}>}
 */
const normalizeMarkers = (markers) => {
  if (!Array.isArray(markers)) return [];
  const uniqueMap = new Map();

  markers.forEach((item) => {
    let id, completedAt;
    if (typeof item === "object" && item !== null) {
      id = String(item.id);
      completedAt = item.completedAt;
    } else {
      id = String(item);
      completedAt = Date.now();
    }

    // If ID exists, keep the one with newer timestamp, or existing if same
    const existing = uniqueMap.get(id);
    if (!existing) {
      uniqueMap.set(id, { id, completedAt });
    } else if (completedAt && existing.completedAt && new Date(completedAt) > new Date(existing.completedAt)) {
      uniqueMap.set(id, { id, completedAt });
    }
  });

  return Array.from(uniqueMap.values());
};

/**
 * 충돌 해결을 포함하여 두 마커 배열을 병합합니다 (3-Way Merge).
 * @param {any[]} localArr - 로컬 마커.
 * @param {any[]} cloudArr - 클라우드 마커.
 * @param {any[]} [baseArr=[]] - 베이스 마커 (마직막 동기화 스냅샷).
 * @param {boolean} [ignoreRemoteDeletions=false] - 원격 삭제 무시 여부 (안전용).
 * @param {boolean} [ignoreLocalDeletions=false] - 로컬 삭제 무시 여부 (안전용).
 * @returns {any[]} 병합된 마커.
 */
const mergeArrays = (localArr, cloudArr, baseArr = [], ignoreRemoteDeletions = false, ignoreLocalDeletions = false) => {
  const localNormalized = normalizeMarkers(localArr);
  const cloudNormalized = normalizeMarkers(cloudArr);
  const baseNormalized = normalizeMarkers(baseArr);

  const mergedMap = new Map();
  const allIds = new Set();

  const localMap = new Map();
  localNormalized.forEach(i => { const id = String(getMarkerId(i)); localMap.set(id, i); allIds.add(id); });

  const cloudMap = new Map();
  cloudNormalized.forEach(i => { const id = String(getMarkerId(i)); cloudMap.set(id, i); allIds.add(id); });

  const baseMap = new Map();
  baseNormalized.forEach(i => { const id = String(getMarkerId(i)); baseMap.set(id, i); allIds.add(id); });

  allIds.forEach(id => {
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);
    const base = baseMap.get(id);

    // 1. 로컬과 클라우드 모두에 존재 -> 병합 (최신 우선 또는 유지)
    if (local && cloud) {
      // 충돌 발생 시 타임스탬프 확인
      if (local.completedAt && cloud.completedAt) {
        const localTime = new Date(local.completedAt).getTime();
        const cloudTime = new Date(cloud.completedAt).getTime();
        mergedMap.set(id, localTime >= cloudTime ? local : cloud);
      } else {
        // 타임스탬프가 없으면 로컬 기본값 사용
        mergedMap.set(id, local);
      }
      return;
    }

    // 2. 로컬에만 존재, 클라우드에 없음
    if (local && !cloud) {
      if (base) {
        // 베이스에 있었으나 클라우드에서 사라짐 -> 원격에서 삭제됨
        if (ignoreRemoteDeletions) {
          // "클라우드가 유실한 것"으로 처리하여 로컬에서 복구
          mergedMap.set(id, local);
        } else {
          // Action: Delete (Do not add to mergedMap)
        }
      } else {
        // 베이스에 없음 -> 로컬에서 추가됨
        // Action: Keep
        mergedMap.set(id, local);
      }
      return;
    }

    // 3. 로컬에는 없고 클라우드에 존재
    if (!local && cloud) {
      if (base) {
        // 베이스에 있었으나 로컬에서 사라짐 -> 로컬에서 삭제됨
        if (ignoreLocalDeletions) {
          // "로컬이 유실한 것"으로 처리하여 클라우드에서 복구
          mergedMap.set(id, cloud);
        } else {
          // Action: Delete (Do not add to mergedMap)
        }
      } else {
        // 베이스에 없음 -> 원격에서 추가됨
        // Action: Keep
        mergedMap.set(id, cloud);
      }
      return;
    }

    // 4. Missing in both (should not happen given we iterate Union)
  });

  return Array.from(mergedMap.values());
};

/**
 * 타임스탬프 기반 충돌 해결을 통해 두 설정 객체를 병합합니다.
 * @param {any} localSettings - 로컬 설정.
 * @param {any} cloudSettings - 클라우드 설정.
 * @returns {any} 병합된 설정.
 */
const mergeSettings = (localSettings, cloudSettings) => {
  const merged = {};
  const mergedTimestamps = {};
  const localTimestamps = localSettings._updatedAt || {};
  const cloudTimestamps = cloudSettings._updatedAt || {};

  const allKeys = new Set([
    ...Object.keys(localSettings).filter((k) => k !== "_updatedAt"),
    ...Object.keys(cloudSettings).filter((k) => k !== "_updatedAt"),
  ]);

  allKeys.forEach((key) => {
    const localValue = localSettings[key];
    const cloudValue = cloudSettings[key];
    const localTime = localTimestamps[key]
      ? new Date(localTimestamps[key]).getTime()
      : 0;
    const cloudTime = cloudTimestamps[key]
      ? new Date(cloudTimestamps[key]).getTime()
      : 0;

    if (localValue !== undefined && cloudValue !== undefined) {
      if (cloudTime > localTime) {
        merged[key] = cloudValue;
        mergedTimestamps[key] = cloudTimestamps[key];
      } else {
        merged[key] = localValue;
        mergedTimestamps[key] =
          localTimestamps[key] || new Date().toISOString();
      }
    } else if (localValue !== undefined) {
      merged[key] = localValue;
      mergedTimestamps[key] = localTimestamps[key] || new Date().toISOString();
    } else if (cloudValue !== undefined) {
      merged[key] = cloudValue;
      mergedTimestamps[key] = cloudTimestamps[key] || new Date().toISOString();
    }
  });

  merged._updatedAt = mergedTimestamps;

  // 안전 가드: 입력값이 있었는데 병합 결과가 비어있는 경우
  if (Object.keys(merged).length <= 1 && (Object.keys(localSettings).length > 1 || Object.keys(cloudSettings).length > 1)) {
    console.error("[Merge] Safety Guard: mergeSettings returned empty object suspiciously. Falling back to local.");
    return localSettings;
  }

  return merged;
};

/**
 * 전체 데이터 객체를 병합합니다 (3-Way Merge).
 * @param {any} local - 로컬 데이터.
 * @param {any} cloud - 클라우드 데이터.
 * @param {any} [base={}] - 베이스 데이터 (스냅샷).
 * @returns {{completedMarkers: any[], favorites: any[], settings: any}} 병합된 데이터.
 */
export const mergeData = (local, cloud, base = {}) => {
  // Cloud Wipe Protection:
  // If Local and Base are similar in size (large), but Cloud is suspiciously empty (< 10%),
  // we assume Cloud was reset and should typically NOT propagate deletions.
  const localCount = local?.completedMarkers?.length || 0;
  const cloudCount = cloud?.completedMarkers?.length || 0;
  const baseCount = base?.completedMarkers?.length || 0;

  let ignoreRemoteDeletions = false;
  if (localCount > 100 && baseCount > 100 && cloudCount < baseCount * 0.1) {
    console.warn(`[Merge] Suspicious Cloud wipe detected (Local: ${localCount}, Cloud: ${cloudCount}, Base: ${baseCount}). Ignoring remote deletions to protect local data.`);
    ignoreRemoteDeletions = true;
  }

  // Local Wipe Protection:
  // If Cloud and Base are similar in size (large), but Local is suspiciously empty (< 10%),
  // we assume Local was reset and should typically NOT propagate deletions.
  let ignoreLocalDeletions = false;
  if (cloudCount > 100 && baseCount > 100 && localCount < baseCount * 0.1) {
    console.warn(`[Merge] Suspicious Local wipe detected (Local: ${localCount}, Cloud: ${cloudCount}, Base: ${baseCount}). Ignoring local deletions to protect cloud data.`);
    ignoreLocalDeletions = true;
  }

  const merged = {
    completedMarkers: mergeArrays(
      local?.completedMarkers || [],
      cloud?.completedMarkers || [],
      base?.completedMarkers || [],
      ignoreRemoteDeletions,
      ignoreLocalDeletions
    ),
    favorites: mergeArrays(
      local?.favorites || [],
      cloud?.favorites || [],
      base?.favorites || []
    ),
    settings: mergeSettings(local?.settings || {}, cloud?.settings || {}),
  };

  // 안전 가드: 병합된 데이터가 비어있는데 로컬에 데이터가 있었던 경우 로컬로 대체
  if (
    merged.completedMarkers.length === 0 &&
    local?.completedMarkers?.length > 0
  ) {
    console.warn("[Merge] Safety Guard: Merged completedMarkers is empty, falling back to local.");
    merged.completedMarkers = local.completedMarkers;
  }

  if (merged.favorites.length === 0 && local?.favorites?.length > 0) {
    console.warn("[Merge] Safety Guard: Merged favorites is empty, falling back to local.");
    merged.favorites = local.favorites;
  }

  return merged;
};

/**
 * 데이터 비교를 위한 해시를 생성합니다.
 * @param {any} data - 해시할 데이터.
 * @returns {string} 해시 문자열.
 */
export const generateDataHash = (data) => {
  // Filter and sort settings to ensure consistent string representation
  const settings = {};
  if (data?.settings) {
    Object.keys(data.settings)
      .filter((k) => !k.startsWith("_")) // Ignore internal keys like _updatedAt
      .sort()
      .forEach((k) => {
        settings[k] = data.settings[k];
      });
  }

  const str = JSON.stringify({
    completedCount: data?.completedMarkers?.length || 0,
    favoritesCount: data?.favorites?.length || 0,
    settings: settings,
  });

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36); // Use base36 for shorter string
};
