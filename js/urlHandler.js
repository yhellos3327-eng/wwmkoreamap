/**
 * URL 파라미터 처리 모듈
 * - 맵 선택, 임베드 모드, 공유 링크 등 URL 기반 설정 처리
 */
import { state, setState } from "./state.js";
import { findItem } from "./ui.js";
import { MAP_CONFIGS } from "./config.js";

/**
 * URL 파라미터를 파싱하여 앱 상태에 반영
 * @returns {URLSearchParams} 파싱된 URL 파라미터 객체
 */
export const handleUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search);

  const mapParam = urlParams.get("map");
  if (mapParam && MAP_CONFIGS[mapParam]) {
    setState("currentMapKey", mapParam);
  }

  if (urlParams.get("embed") === "true") {
    document.body.classList.add("embed-mode");
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.add("collapsed");
  }

  if (urlParams.get("overlay") === "true") {
    document.body.classList.add("overlay-mode");
  }

  return urlParams;
};

/**
 * 공유 링크 파라미터를 처리하여 해당 위치로 이동
 * @param {URLSearchParams} urlParams - URL 파라미터 객체
 */
export const handleSharedLink = (urlParams) => {
  const sharedId = parseInt(urlParams.get("id"));
  const sharedLat = parseFloat(urlParams.get("lat"));
  const sharedLng = parseFloat(urlParams.get("lng"));
  const routeParam = urlParams.get("route");

  if (routeParam) {
    import("./route/index.js")
      .then((routeModule) => {
        routeModule.loadRouteFromUrl();
      })
      .catch((err) => {
        console.error("Failed to load shared route:", err);
      });
    return;
  }

  if (sharedId) {
    setTimeout(() => findItem(sharedId), 1000);
    return;
  }

  if (!isNaN(sharedLat) && !isNaN(sharedLng)) {
    setTimeout(() => {
      if (state.map) {
        state.map.flyTo([sharedLat, sharedLng], 17, { animate: true });
      }
    }, 1000);
  }
};

/**
 * URL에서 특정 파라미터 값 추출
 * @param {string} key - 파라미터 키
 * @returns {string|null} 파라미터 값
 */
export const getUrlParam = (key) => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
};

/**
 * 현재 URL에 파라미터 추가/업데이트 (히스토리 변경 없음)
 * @param {string} key - 파라미터 키
 * @param {string} value - 파라미터 값
 */
export const setUrlParam = (key, value) => {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState({}, "", url);
};

/**
 * 현재 URL에서 파라미터 제거
 * @param {string} key - 파라미터 키
 */
export const removeUrlParam = (key) => {
  const url = new URL(window.location.href);
  url.searchParams.delete(key);
  window.history.replaceState({}, "", url);
};
