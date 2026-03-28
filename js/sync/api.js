import { BACKEND_URL } from "../config.js";

/**
 * 인증 헤더를 동적으로 가져옵니다.
 * JWT는 httpOnly 쿠키에 자동으로 포함되므로 Authorization 헤더는 필요 없습니다.
 * @returns {Promise<Object>}
 */
const getHeaders = async () => {
  try {
    const { getAuthHeaders } = await import("../auth.js");
    return getAuthHeaders();
  } catch (e) {
    return { "Content-Type": "application/json" };
  }
};

/**
 * fetchWithAuth 래퍼 (401 시 token refresh 후 재시도)
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
const authFetch = async (url, options) => {
  try {
    const { fetchWithAuth } = await import("../auth.js");
    return fetchWithAuth(url, options);
  } catch (e) {
    return fetch(url, options);
  }
};

/**
 * 클라우드에서 사용자 데이터를 가져옵니다.
 * @returns {Promise<{data: any|null, version: number}>} 클라우드 데이터 및 버전.
 */
export const fetchCloudData = async () => {
  const headers = await getHeaders();
  const response = await authFetch(`${BACKEND_URL}/api/sync/load`, {
    credentials: "include",
    headers
  });
  const result = await response.json();
  return {
    data: result.success ? result.data : null,
    version: result.version || 0
  };
};

/**
 * 사용자 데이터를 클라우드에 저장합니다.
 * @param {any} data - 저장할 데이터.
 * @param {number|undefined} expectedVersion - 낙관적 잠금을 위한 예상 서버 버전.
 * @returns {Promise<any>} 저장 응답.
 */
export const saveCloudData = async (data, expectedVersion = undefined) => {
  const payload = { ...data };
  if (expectedVersion !== undefined) {
    payload.expectedVersion = expectedVersion;
  }

  const headers = await getHeaders();
  const response = await authFetch(`${BACKEND_URL}/api/sync/save`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  });

  // 충돌(409) 처리
  if (response.status === 409) {
    const errorData = await response.json();
    const error = /** @type {any} */ (new Error(`Conflict detected: ${errorData.message}`));
    error.name = "VersionConflictError";
    error.serverVersion = errorData.currentVersion;
    throw error;
  }

  if (!response.ok) throw new Error(`Failed to save: ${response.status}`);
  return await response.json();
};

/**
 * 클라우드에서 백업 목록을 가져옵니다.
 * @returns {Promise<any[]>} 백업 목록 배열.
 */
export const fetchBackupList = async () => {
  const headers = await getHeaders();
  const response = await authFetch(`${BACKEND_URL}/api/backup/list`, {
    credentials: "include",
    headers
  });
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const result = await response.json();
  return result.success ? result.backups : [];
};

/**
 * 클라우드 백업을 생성합니다.
 * @param {string|null} [label=null] - 선택적 백업 레이블.
 * @param {any|null} [data=null] - 직접 백업할 선택적 데이터 (서버 상태를 덮어씀).
 * @returns {Promise<any>} 저장 응답.
 */
export const saveCloudBackup = async (label = null, data = null) => {
  const payload = { label };
  if (data) {
    Object.assign(payload, data);
  }

  const headers = await getHeaders();
  const response = await authFetch(`${BACKEND_URL}/api/backup/save`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Failed to save: ${response.status}`);
  return await response.json();
};

/**
 * 백업에서 데이터를 복원합니다.
 * @param {string} backupId - 복원할 백업 ID.
 * @returns {Promise<any>} 복원 응답.
 */
export const restoreFromBackup = async (backupId) => {
  const headers = await getHeaders();
  const response = await authFetch(
    `${BACKEND_URL}/api/backup/restore/${backupId}`,
    {
      method: "POST",
      credentials: "include",
      headers
    },
  );
  if (!response.ok) throw new Error(`Failed to restore: ${response.status}`);
  return await response.json();
};
