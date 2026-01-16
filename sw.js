// ServiceWorker 비활성화됨
// 이 파일은 기존 ServiceWorker를 해제하기 위해 유지됩니다.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 모든 캐시 삭제
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((name) => caches.delete(name)));
    }),
  );
  self.clients.claim();
});

// fetch 이벤트 처리 안 함 (네트워크 직접 사용)
