self.onmessage = async (e) => {
  const { type, payload, taskId } = e.data;

  try {
    let result;
    switch (type) {
      case "CACHE_URLS":
        result = await cacheUrls(payload.urls, payload.cacheName);
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    self.postMessage({ taskId, success: true, result });
  } catch (error) {
    self.postMessage({ taskId, success: false, error: error.message });
  }
};

async function cacheUrls(urls, cacheName = "web-llm-cache") {
  const cache = await caches.open(cacheName);
  const results = [];

  for (const url of urls) {
    try {
      const match = await cache.match(url);
      if (match) {
        results.push({ url, status: "cached" });
        continue;
      }

      
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
      }

      await cache.put(url, response);
      results.push({ url, status: "downloaded" });
    } catch (err) {
      console.error(`Cache worker error for ${url}:`, err);
      results.push({ url, status: "error", error: err.message });
    }
  }
  return results;
}
