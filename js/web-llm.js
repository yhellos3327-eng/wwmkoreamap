// @ts-nocheck
/**
 * @fileoverview WebLLM integration module - provides local LLM chat functionality using WebGPU.
 * Handles model loading, caching, and chat message generation with RAG context.
 * @module web-llm
 */

import { state, subscribe } from "./state.js";
import { logger } from "./logger.js";
import { webWorkerManager } from "./web-worker-manager.js";

/**
 * Storage keys for WebLLM settings.
 * @type {Object<string, string>}
 */
const STORAGE_KEYS = {
  MODEL_ID: "wwm_webllm_model_id",
  AUTO_MODEL: "wwm_webllm_auto_model",
  THINKING_ENABLED: "wwm_webllm_thinking",
  SHOW_THINKING: "wwm_webllm_show_thinking",
  CUSTOM_MODELS: "wwm_webllm_custom_models",
  PRE_CACHE_DONE: "wwm_webllm_precache_done",
};

const MODEL_PRESETS = [
  {
    id: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC",
    label: "0.5B",
    vramGb: 0.5,
    supportsThinking: false,
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "1.5B",
    vramGb: 1.6,
    supportsThinking: false,
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "3B",
    vramGb: 2.8,
    supportsThinking: false,
  },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    label: "7B",
    vramGb: 5.2,
    supportsThinking: false,
  },
  {
    id: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
    label: "8B",
    vramGb: 6.1,
    supportsThinking: true,
  },
];

const DEFAULT_MODEL_ID = MODEL_PRESETS[1].id;

const LLM_PARAMS = {
  chat: {
    temperature: 0.4,
    top_p: 0.85,
    max_tokens: 512,
    repetition_penalty: 1.1,
    frequency_penalty: 0.25,
    presence_penalty: 0.2,
  },
  thinking: {
    temperature: 0.25,
    top_p: 0.85,
    max_tokens: 1024,
    repetition_penalty: 1.08,
    frequency_penalty: 0.2,
    presence_penalty: 0.2,
  },
};

let webllmModule = null;
let mlcEngine = null;
let currentModelId = null;
let isEngineLoading = false;
let engineLoadingProgress = { progress: 0, text: "" };
let isPreCacheInProgress = false;

let loadingMessageEl = null;
let isInitialized = false;
let initPromise = null;

/**
 * Toggles thinking mode and persists the setting.
 * @param {boolean} enabled - Whether thinking mode should be enabled.
 * @returns {Promise<void>}
 */
export async function setThinkingEnabled(enabled) {
  const { primaryDb } = await import("./storage/db.js");
  const value = enabled ? "true" : "false";
  const result = await primaryDb.set(STORAGE_KEYS.THINKING_ENABLED, value);
  if (!result || !result.success) {
    logger.error("WebLLM", "Failed to save thinking mode setting", result);
  } else {
    logger.log("WebLLM", `Thinking mode set to: ${enabled}`);
  }
}

/**
 * Gets the current thinking mode setting.
 * @returns {Promise<boolean>} Whether thinking mode is enabled.
 */
export async function isThinkingEnabled() {
  const { primaryDb } = await import("./storage/db.js");
  const stored = await primaryDb.get(STORAGE_KEYS.THINKING_ENABLED);
  // Normalize: accept string "true", boolean true, or treat null/undefined as false
  if (stored === true || stored === "true") return true;
  return false;
}

const categoryIdToKoreanMap = new Map();
const infoIdToKoreanMap = new Map();

/**
 * Initialize mappings from category and info IDs to their Korean display names.
 *
 * Populates the module-level maps `categoryIdToKoreanMap` and `infoIdToKoreanMap`
 * using available translation sources in `state` (including `koDict`,
 * `categoryItemTranslations`, and `mapData`). Existing entries in both maps are
 * cleared before population. The function also logs the resulting map sizes.
 */
function initializeIdMaps() {
  categoryIdToKoreanMap.clear();
  infoIdToKoreanMap.clear();

  if (state.koDict) {
    for (const [key, value] of Object.entries(state.koDict)) {
      if (key && value) {
        categoryIdToKoreanMap.set(key, value);
        infoIdToKoreanMap.set(key, value);
      }
    }
  }

  if (state.categoryItemTranslations) {
    for (const [catId, items] of Object.entries(
      state.categoryItemTranslations,
    )) {
      if (state.koDict[catId]) {
        categoryIdToKoreanMap.set(catId, state.koDict[catId]);
      }

      if (items && typeof items === "object") {
        for (const [itemKey, itemData] of Object.entries(items)) {
          if (itemKey === "_common_description") continue;
          if (itemData?.name) {
            infoIdToKoreanMap.set(itemKey, itemData.name);
          }
        }
      }
    }
  }

  if (state.mapData?.categories) {
    for (const cat of state.mapData.categories) {
      const koreanName =
        state.koDict?.[cat.id] ??
        state.koDict?.[cat.name] ??
        cat.name ??
        cat.id;
      categoryIdToKoreanMap.set(cat.id, koreanName);
      if (cat.name) {
        categoryIdToKoreanMap.set(cat.name, koreanName);
      }
    }
  }

  if (state.mapData?.items) {
    for (const item of state.mapData.items) {
      if (item.id) {
        const koreanName =
          item.nameKo || state.koDict?.[item.id] || item.name || item.id;
        infoIdToKoreanMap.set(item.id, koreanName);
      }
      if (item.categoryId) {
        const catKorean = state.koDict?.[item.categoryId] || item.categoryId;
        categoryIdToKoreanMap.set(item.categoryId, catKorean);
      }
    }
  }

  logger.log(
    "WebLLM",
    `ID 맵 초기화 완료: 카테고리 ${categoryIdToKoreanMap.size}개, 정보 ${infoIdToKoreanMap.size}개`,
  );
}

/**
 * 카테고리 ID를 한국어 이름으로 변환
 */
export function getCategoryKorean(categoryId) {
  if (!categoryId) return categoryId;
  return (
    categoryIdToKoreanMap.get(categoryId) ??
    categoryIdToKoreanMap.get(String(categoryId)) ??
    state.koDict?.[categoryId] ??
    categoryId
  );
}

/**
 * Get the Korean display name for a given information item ID.
 *
 * Looks up the ID in the internal info-to-Korean map, then in the global `state.koDict`,
 * and returns the original `infoId` if no mapping is found.
 * @param {string|number} infoId - The information item identifier to resolve.
 * @returns {string|number} The resolved Korean name, or the original `infoId` if unresolved.
 */
export function getInfoKorean(infoId) {
  if (!infoId) return infoId;
  return (
    infoIdToKoreanMap.get(infoId) ??
    infoIdToKoreanMap.get(String(infoId)) ??
    state.koDict?.[infoId] ??
    infoId
  );
}

/**
 * Convert an item object into a single RAG-formatted Korean text line.
 *
 * Builds a compact, pipe-separated string containing available item fields
 * (ID, Korean name / NPC, category, region, coordinates, and sanitized description).
 *
 * @param {Object} item - Item data; commonly includes: `id`, `nameKo`, `name`, `category`, `regionName`, `region`, `x`, `y`, `description`.
 * @returns {string} The formatted RAG text (pipe-separated). Returns an empty string if `item` is falsy or contains no usable fields.
 */
export function itemToRAGText(item) {
  if (!item) return "";

  const parts = [];

  // ID와 이름 (가장 중요)
  if (item.id) parts.push(`ID:${item.id}`);
  const name = item.nameKo ?? getInfoKorean(item.id) ?? item.name ?? item.id;
  if (name) parts.push(`이름:${name}`);

  // 카테고리 및 지역
  if (item.category) {
    const catKorean = getCategoryKorean(item.category);
    parts.push(`유형:${catKorean}`);
  }

  if (item.regionName || item.region) {
    const region = item.regionName || item.region;
    const regionKorean = state.koDict?.[region] || region;
    parts.push(`지역:${regionKorean}`);
  }

  // 좌표 (덜 중요하지만 위치 파악용)
  if (item.x !== undefined && item.y !== undefined) {
    parts.push(`좌표:[${item.x.toFixed(1)},${item.y.toFixed(1)}]`);
  }

  // 설명 (매우 중요)
  if (item.description) {
    const desc = item.description.replace(/<[^>]*>/g, " ").trim();
    if (desc) parts.push(`설명:${desc}`);
  }

  return parts.join(" | ");
}

/**
 * Format a list of items into a RAG context string for LLM consumption.
 *
 * The returned string begins with a header stating the total number of matched items,
 * followed by numbered lines describing up to `maxItems` items, and ends with a
 * summary line indicating how many items were omitted when the list is truncated.
 *
 * @param {Array<Object>} items - Array of item objects to include in the context.
 * @param {number} [maxItems=20] - Maximum number of items to include in the detailed list.
 * @returns {string} A formatted context string containing the total count, numbered item entries, and an omission summary when applicable.
 */
export function itemsToContext(items, maxItems = 20) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return "현재 표시된 아이템이 없습니다.";
  }

  const limited = items.slice(0, maxItems);
  const lines = [`[검색된 아이템 총 개수: ${items.length}개]`];

  lines.push(...limited.map((item, i) => `${i + 1}. ${itemToRAGText(item)}`));

  if (items.length > maxItems) {
    lines.push(`... 외 ${items.length - maxItems}개 항목`);
  }

  return lines.join("\n");
}

/**
 * Check whether a usable WebGPU adapter and device are available.
 * @returns {boolean} `true` if a high-performance WebGPU adapter and a device (with optional `shader-f16` feature) can be obtained, `false` otherwise.
 */
async function checkWebGPUSupport() {
  try {
    if (typeof navigator === "undefined" || !navigator.gpu) return false;

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });

    if (!adapter || adapter.info?.isFallbackAdapter) return false;

    const features = [];
    if (adapter.features.has("shader-f16")) {
      features.push("shader-f16");
    }

    const device = await adapter.requestDevice({ requiredFeatures: features });
    device.destroy();

    return true;
  } catch (e) {
    logger.warn("WebLLM", "WebGPU 지원 확인 실패:", e);
    return false;
  }
}

/**
 * Dynamically loads and caches the WebLLM runtime module.
 *
 * If the module was previously loaded, the cached instance is returned.
 *
 * @returns {Promise<unknown>} The loaded WebLLM module.
 * @throws {Error} The original import error if the module fails to load.
 */
async function loadWebLLMModule() {
  if (webllmModule) return webllmModule;

  try {
    webllmModule = await import("https://esm.run/@mlc-ai/web-llm@0.2.78");
    logger.success("WebLLM", "WebLLM 모듈 로드 완료");
    return webllmModule;
  } catch (e) {
    logger.error("WebLLM", "WebLLM 모듈 로드 실패:", e);
    throw e;
  }
}

/**
 * Check whether a model is present in the local WebLLM model cache.
 * @param {string} modelId - The identifier of the model to check.
 * @returns {boolean} `true` if the model is found in the cache, `false` otherwise (also `false` if an error occurs).
 */
async function hasModelInCache(modelId) {
  try {
    const module = await loadWebLLMModule();
    if (!module.hasModelInCache) {
      const cache = await caches.open("webllm-model-cache");
      const keys = await cache.keys();
      return keys.some((req) => req.url.includes(modelId));
    }
    return await module.hasModelInCache(modelId, module.prebuiltAppConfig);
  } catch (e) {
    logger.warn("WebLLM", "캐시 확인 실패:", e);
    return false;
  }
}

/**
 * Get the current model identifier from persistent storage, falling back to the default.
 * @returns {string} The stored model ID if it matches a known preset; otherwise the default model ID.
 */
async function getStoredModelId() {
  const { primaryDb } = await import("./storage/db.js");
  const stored = await primaryDb.get(STORAGE_KEYS.MODEL_ID);
  if (stored && MODEL_PRESETS.some((p) => p.id === stored)) {
    return stored;
  }
  return DEFAULT_MODEL_ID;
}

/**
 * Check the installation status of a model by its identifier.
 * @param {string} modelId - The model identifier to check.
 * @returns {{kind: "installed"} | {kind: "not-installed"} | {kind: "error", message: string}} The install state:
 * - `{kind: "installed"}` if the model is cached,
 * - `{kind: "not-installed"}` if it is not cached,
 * - `{kind: "error", message}` if the check failed.
 */
async function getInstallState(modelId) {
  try {
    const inCache = await hasModelInCache(modelId);
    if (inCache) {
      return { kind: "installed" };
    }
    return { kind: "not-installed" };
  } catch (e) {
    return { kind: "error", message: e.message ?? "상태 확인 실패" };
  }
}

/**
 * Create a progress handler that updates the module's engine loading state and forwards updates.
 * @param {(progress: {progress: number, text: string}) => void} [onProgress] - Optional callback to receive progress updates.
 * @returns {(progress: {progress: number, text: string}) => void} A callback that accepts a progress object, sets the module-level `engineLoadingProgress`, invokes `onProgress` if provided, and logs the progress.
 */
function createProgressCallback(onProgress) {
  return (progress) => {
    engineLoadingProgress = progress;
    if (onProgress) {
      onProgress(progress);
    }
    logger.log(
      "WebLLM",
      `로딩: ${progress.text} (${(progress.progress * 100).toFixed(1)}%)`,
    );
  };
}

/**
 * Create or reuse the ML engine for the given model identifier.
 * @param {string} modelId - Identifier of the model to load or reuse.
 * @param {function({text:string,ratio:number}):void} [onProgress] - Optional callback invoked with progress updates; receives an object with `text` (status message) and `ratio` (0.0–1.0).
 * @returns {object} The MLCEngine instance ready for use.
 * @throws {Error} If an engine is already loading or if engine creation fails.
 */
async function getOrCreateEngine(modelId, onProgress) {
  if (isEngineLoading) {
    throw new Error("엔진이 이미 로딩 중입니다");
  }

  if (mlcEngine && currentModelId === modelId) {
    return mlcEngine;
  }

  isEngineLoading = true;

  try {
    const module = await loadWebLLMModule();

    if (mlcEngine && currentModelId !== modelId) {
      try {
        await mlcEngine.unload();
      } catch (e) {
        logger.warn("WebLLM", "기존 엔진 언로드 실패:", e);
      }
    }

    if (typeof Worker !== "undefined") {
      try {
        const worker = new Worker("./js/workers/webllm-worker.js", {
          type: "module",
        });

        worker.addEventListener("error", (e) => {
          logger.error("WebLLM", "워커 에러:", e);
        });

        mlcEngine = await module.CreateWebWorkerMLCEngine(worker, modelId, {
          appConfig: module.prebuiltAppConfig,
          initProgressCallback: createProgressCallback(onProgress),
        });
      } catch (e) {
        logger.warn("WebLLM", "워커 엔진 생성 실패, 메인 스레드 폴백:", e);
        mlcEngine = await module.CreateMLCEngine(modelId, {
          appConfig: module.prebuiltAppConfig,
          initProgressCallback: createProgressCallback(onProgress),
        });
      }
    } else {
      mlcEngine = await module.CreateMLCEngine(modelId, {
        appConfig: module.prebuiltAppConfig,
        initProgressCallback: createProgressCallback(onProgress),
      });
    }

    currentModelId = modelId;
    logger.success("WebLLM", `엔진 생성 완료: ${modelId}`);

    return mlcEngine;
  } catch (e) {
    logger.error("WebLLM", "엔진 생성 실패:", e);
    throw e;
  } finally {
    isEngineLoading = false;
  }
}

/**
 * Preloads and warms the selected model so chat generation starts without delay.
 *
 * Attempts to ensure a model engine is created and ready. If WebGPU is unavailable the operation is skipped. By default it will skip work when the model is already cached unless `force` is true. Progress, completion, and error events can be observed via callbacks.
 *
 * @param {Object} [options] - Precache options.
 * @param {boolean} [options.force=false] - If true, recreate or warm the engine even when the model appears cached.
 * @param {(progress: { text?: string, percent?: number }) => void} [options.onProgress] - Called with progress updates during engine creation.
 * @param {() => void} [options.onComplete] - Called when precache completes successfully.
 * @param {(err: any) => void} [options.onError] - Called if precache fails with an error.
 */
export async function preCacheModel(options = {}) {
  const { force = false, onProgress, onComplete, onError } = options;

  if (isPreCacheInProgress) {
    logger.log("WebLLM", "사전 캐시 이미 진행 중");
    return;
  }

  const hasWebGPU = await checkWebGPUSupport();
  if (!hasWebGPU) {
    logger.warn("WebLLM", "WebGPU 미지원, 사전 캐시 스킵");
    return;
  }

  const modelId = await getStoredModelId();

  if (!force) {
    const cached = await hasModelInCache(modelId);
    if (cached) {
      logger.log("WebLLM", `모델 이미 캐시됨: ${modelId}`);

      try {
        isPreCacheInProgress = true;
        await getOrCreateEngine(modelId, onProgress);
        if (onComplete) onComplete();
      } catch (e) {
        if (onError) onError(e);
      } finally {
        isPreCacheInProgress = false;
      }
      return;
    }
  }

  isPreCacheInProgress = true;
  logger.log("WebLLM", `사전 캐시 시작: ${modelId}`);

  try {
    await getOrCreateEngine(modelId, onProgress);
    const { primaryDb } = await import("./storage/db.js");
    await primaryDb.set(STORAGE_KEYS.PRE_CACHE_DONE, "true");
    logger.success("WebLLM", "사전 캐시 완료");
    if (onComplete) onComplete();
  } catch (e) {
    logger.error("WebLLM", "사전 캐시 실패:", e);
    if (onError) onError(e);
  } finally {
    isPreCacheInProgress = false;
  }
}

/**
 * Schedules a background model precache to run after an optional delay, using requestIdleCallback when available.
 * @param {Object} [options] - Configuration for scheduling.
 * @param {number} [options.delay=5000] - Milliseconds to wait before scheduling the precache.
 */
export function schedulePreCache(options = {}) {
  const { delay = 5000 } = options;

  setTimeout(() => {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(
        () => {
          preCacheModel(options);
        },
        { timeout: 30000 },
      );
    } else {
      preCacheModel(options);
    }
  }, delay);
}

/**
 * Selects relevant map items for retrieval-augmented generation (RAG) based on the user's query.
 *
 * Uses region and category keyword heuristics (including "ground"/"underground" qualifiers) for a precise targeted search and falls back to a scored relevance search across item name, region, category, description, and id when no precise matches are found.
 *
 * @param {string} query - The user's search query.
 * @returns {Array<Object>} An array of matching map item objects; may be empty if no relevant items are found.
 */
function searchItemsForContext(query) {
  if (!state.mapData?.items) return [];

  const queryLower = query.toLowerCase().trim();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length >= 1);

  const visibleItems = [];
  const isVisibilityQuery = false;

  let targetRegion = null;
  if (state.uniqueRegions) {
    for (const region of state.uniqueRegions) {
      if (!region) continue;
      const regionLower = region.toLowerCase();
      const regionKo = (state.koDict?.[region] || region).toLowerCase();

      if (queryLower.includes(regionLower) || queryLower.includes(regionKo)) {
        targetRegion = region;
        break;
      }
    }
  }

  const categoryKeywords = [
    "상자",
    "보물",
    "기믹",
    "퍼즐",
    "만사록",
    "수집품",
    "재료",
    "몬스터",
    "NPC",
    "퀘스트",
    "낚시",
    "채집",
  ];
  const targetKeyword = categoryKeywords.find((k) => queryLower.includes(k));

  let results = [];

  if (targetRegion || targetKeyword) {
    const basePool = state.mapData.items;

    results = basePool.filter((item) => {
      const regionKo = state.koDict?.[item.region] || item.region || "";
      const categoryKo = getCategoryKorean(item.category) || "";
      const nameKo = (
        item.nameKo ||
        getInfoKorean(item.id) ||
        item.name ||
        ""
      ).toLowerCase();

      let match = true;

      if (targetRegion) {
        const itemRegion = (item.region || "").toLowerCase();
        const itemRegionKo = (
          state.koDict?.[item.region] ||
          item.region ||
          ""
        ).toLowerCase();
        const targetLower = targetRegion.toLowerCase();
        const targetKo = (
          state.koDict?.[targetRegion] || targetRegion
        ).toLowerCase();

        const regionMatch =
          itemRegion.includes(targetLower) ||
          itemRegionKo.includes(targetLower) ||
          itemRegion.includes(targetKo) ||
          itemRegionKo.includes(targetKo);

        if (!regionMatch) return false;
        match = true;
      }

      if (targetKeyword) {
        const nameMatch = nameKo.includes(targetKeyword);
        const categoryMatch = categoryKo.includes(targetKeyword);

        const isBoxCategory =
          item.category === "17310010006" ||
          item.category === "17310010007" ||
          item.category === "17310010005";

        let keywordMatch = nameMatch || categoryMatch;

        if (targetKeyword === "상자") {
          keywordMatch = keywordMatch || isBoxCategory;
        } else if (targetKeyword === "낚시") {
          const isFishingCategory = item.category === "17310010011";
          keywordMatch = keywordMatch || isFishingCategory;
        } else {
          keywordMatch =
            keywordMatch ||
            (item.description && item.description.includes(targetKeyword));
        }

        if (!keywordMatch) return false;
        match = true;
      }

      if (queryLower.includes("지상") && !queryLower.includes("지하")) {
        const isGround =
          item.description &&
          (item.description.includes("지상") ||
            !item.description.includes("지하"));
        match = match && isGround;
      } else if (queryLower.includes("지하") && !queryLower.includes("지상")) {
        const isUnderground =
          item.description && item.description.includes("지하");
        match = match && isUnderground;
      }

      return match;
    });

    if (results.length > 0) {
      logger.log(
        "WebLLM",
        `정밀 검색 성공: ${isVisibilityQuery ? "[현재 화면] " : ""}${targetRegion ? `지역[${targetRegion}] ` : ""}${targetKeyword ? `키워드[${targetKeyword}] ` : ""}-> ${results.length}개 발견`,
      );
      return results;
    }
  }

  if (
    queryTerms.length === 0 ||
    (queryTerms.length === 1 && queryTerms[0].length < 2)
  ) {
    return isVisibilityQuery ? visibleItems : [];
  }

  const scoredItems = state.mapData.items.map((item) => {
    let score = 0;
    const name = (
      item.nameKo ||
      getInfoKorean(item.id) ||
      item.name ||
      ""
    ).toLowerCase();
    const region = (
      state.koDict?.[item.region] ||
      item.region ||
      ""
    ).toLowerCase();
    const category = (getCategoryKorean(item.categoryId) || "").toLowerCase();
    const desc = (item.description || "").toLowerCase();

    queryTerms.forEach((term) => {
      // 정확한 일치에 높은 가중치
      if (name === term) score += 30;
      else if (name.startsWith(term)) score += 20;
      else if (name.includes(term)) score += 10;

      if (region === term) score += 15;
      else if (region.includes(term)) score += 8;

      if (category === term) score += 20;
      else if (category.includes(term)) score += 12;

      if (desc.includes(term)) score += 5;
      if (item.id && String(item.id).includes(term)) score += 15;
    });

    return { item, score };
  });

  results = scoredItems
    .filter((entry) => entry.score > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((entry) => entry.item);

  return results;
}

/**
 * Build the system prompt used by the LLM, customized for the current map and model size.
 * @param {string} context - Formatted RAG context containing relevant map items and their details.
 * @returns {string} The complete system prompt in Korean tailored to either a compact or full instruction set depending on the selected model.
 */
function buildSystemPrompt(context) {
  const mapKey = state.currentMapKey ?? "qinghe";
  const mapName = state.koDict?.[mapKey] ?? mapKey;

  const isSmallModel = currentModelId && currentModelId.includes("0.5B");

  if (isSmallModel) {
    return `당신은 ${mapName} 지도 도우미입니다. 한국어로 답변하세요.

## 데이터
${context}

## 규칙
1. 아이템 개수 요약
2. [이름](jumpToId:ID) 링크 필수
3. 설명 포함
4. 모르면 모른다고 하기`;
  }

  return `당신은 ${mapName} 지도의 전문가 AI 가이드입니다.
사용자의 질문에 대해 제공된 [검색 결과]를 바탕으로 정확하고 도움이 되는 답변을 제공하세요.

## 역할 및 태도
- 친절하고 전문적인 가이드처럼 행동하세요.
- 추측하지 말고, 오직 제공된 데이터에 기반해서만 답변하세요.
- 데이터가 부족하면 "정보가 없습니다"라고 솔직히 말하세요.

## 답변 작성 규칙
1. **요약 먼저**: 질문과 관련된 아이템이 총 몇 개인지 먼저 요약하세요.
2. **링크 필수**: 위치나 아이템을 언급할 때는 반드시 \`[이름](jumpToId:ID)\` 형식을 사용하세요. (예: [상자](jumpToId:12345))
3. **상세 정보**: 아이템의 설명, NPC 이름, 획득 방법 등이 있다면 포함하세요.
4. **논리적 구성**: 
   - 사용자의 의도를 파악하고,
   - 검색 결과에서 관련 정보를 찾은 뒤,
   - 이를 종합하여 답변을 구성하세요.

## 검색 결과 데이터
${context}

항상 한국어로 답변하세요.`;
}

/**
 * Send a chat message to the WebLLM engine using optional RAG context and streaming callbacks.
 * @param {string} userMessage - The user's message to send to the model.
 * @param {Object} [options] - Optional settings for the request.
 * @param {Array} [options.items] - Context items to include for RAG; formatted via itemsToContext.
 * @param {function(Object): void} [options.onStream] - Called repeatedly with streaming updates: `{ content, thinking, isThinking }` where `content` is the assistant-visible text, `thinking` is interim thinking text, and `isThinking` indicates whether a thinking block is active.
 * @param {function(Object): void} [options.onComplete] - Called once when generation finishes with the final result: `{ content, thinking }`.
 * @param {function(Error): void} [options.onError] - Called on errors that occur during engine retrieval or generation.
 * @param {boolean} [options.enableThinking=false] - If true and the selected model supports it, enable the model's "thinking" mode (internal deliberation blocks).
 * @returns {{content: string, thinking: string}} The final assistant-visible text in `content` and any accumulated thinking text in `thinking`.
 */
export async function sendChatMessage(userMessage, options = {}) {
  const {
    items = [],
    onStream,
    onComplete,
    onError,
    enableThinking = false,
  } = options;

  if (categoryIdToKoreanMap.size === 0) {
    initializeIdMaps();
  }

  const context = itemsToContext(items, 15);

  const modelId = await getStoredModelId();
  let engine;

  try {
    engine = await getOrCreateEngine(modelId);
  } catch (e) {
    if (onError) onError(e);
    throw e;
  }

  const preset = MODEL_PRESETS.find((p) => p.id === modelId);
  const supportsThinking = preset?.supportsThinking || false;
  const useThinking = enableThinking && supportsThinking;
  const mode = useThinking ? "thinking" : "chat";

  const messages = [
    { role: "system", content: buildSystemPrompt(context) },
    { role: "user", content: userMessage },
  ];

  try {
    const stream = await engine.chat.completions.create({
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...LLM_PARAMS[mode],
      ...(supportsThinking && { extra_body: { enable_thinking: useThinking } }),
    });

    let fullContent = "";
    let thinkingContent = "";
    let inThinking = false;
    let buffer = "";

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";

      if (delta) {
        buffer += delta;

        if (supportsThinking) {
          while (true) {
            if (!inThinking) {
              const startIdx = buffer.indexOf("<think>");
              if (startIdx !== -1) {
                fullContent += buffer.slice(0, startIdx);
                buffer = buffer.slice(startIdx + 7);
                inThinking = true;
                continue;
              }
              break;
            } else {
              const endIdx = buffer.indexOf("</think>");
              if (endIdx !== -1) {
                thinkingContent += buffer.slice(0, endIdx);
                buffer = buffer.slice(endIdx + 8);
                inThinking = false;
                continue;
              }
              break;
            }
          }

          if (!inThinking) {
            fullContent += buffer;
            buffer = "";
          } else {
            thinkingContent += buffer;
            buffer = "";
          }
        } else {
          fullContent += delta;
        }

        if (onStream) {
          onStream({
            content: fullContent,
            thinking: thinkingContent,
            isThinking: inThinking,
          });
        }
      }
    }

    const result = {
      content: fullContent.trim(),
      thinking: thinkingContent.trim(),
    };

    if (onComplete) onComplete(result);
    return result;
  } catch (e) {
    logger.error("WebLLM", "채팅 생성 실패:", e);
    if (onError) onError(e);
    throw e;
  }
}

/**
 * Attempt to interrupt any in-progress model generation.
 *
 * If an ML engine is active, requests it to stop the current generation.
 * Any errors raised while attempting to interrupt are caught and suppressed.
 */
export function interruptGeneration() {
  if (mlcEngine) {
    try {
      mlcEngine.interruptGenerate();
      logger.log("WebLLM", "생성 중단됨");
    } catch (e) {
      logger.warn("WebLLM", "생성 중단 실패:", e);
    }
  }
}

/**
 * Clear the active ML engine's conversational state.
 *
 * If no engine is active, this function performs no action.
 */
export function resetChat() {
  if (mlcEngine) {
    try {
      mlcEngine.resetChat();
      logger.log("WebLLM", "채팅 리셋됨");
    } catch (e) {
      logger.warn("WebLLM", "채팅 리셋 실패:", e);
    }
  }
}

let chatHistory = [];
let isGenerating = false;

/**
 * Open the WebLLM modal, ensure the module is initialized, and start model precaching.
 *
 * Ensures WebLLM is initialized, makes the modal visible, initializes ID mappings,
 * begins background model precaching (with UI progress/error hooks), updates UI status,
 * and focuses the modal's textarea when available.
 */
export async function openWebLLMModal() {
  if (!isInitialized) {
    await initWebLLM();
  }

  const modal = document.getElementById("web-llm-modal");
  if (!modal) return;

  modal.classList.remove("hidden");

  initializeIdMaps();

  // 모달이 열릴 때 모델 로드/캐시 확인 시작
  preCacheModel({
    onProgress: () => updateUIStatus(),
    onComplete: () => updateUIStatus(),
    onError: (e) => {
      logger.error("WebLLM", "모델 로드 실패:", e);
      updateUIStatus();
    },
  });

  await updateUIStatus();

  const textarea = modal.querySelector(".web-llm-textarea");
  if (textarea) textarea.focus();
}

/**
 * Close the WebLLM modal and stop any ongoing model generation.
 *
 * Hides the modal element (id "web-llm-modal") if present and interrupts any active generation.
 */
export function closeWebLLMModal() {
  const modal = document.getElementById("web-llm-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  interruptGeneration();
}

/**
 * Update the WebLLM UI status indicators to reflect environment, engine loading, and model install state.
 *
 * Checks WebGPU availability and the selected model's install state, then updates the status text, the
 * CSS status color (--before-bg), the send button enabled state, the loading chat message, and the
 * progress bar display/width to match the current condition.
 */
async function updateUIStatus() {
  const statusEl = document.querySelector(".web-llm-status");
  const sendBtn = document.querySelector(".web-llm-send-btn");
  if (!statusEl) return;

  const modelId = getStoredModelId();
  const preset = MODEL_PRESETS.find((p) => p.id === modelId);

  const hasGPU = await checkWebGPUSupport();
  if (!hasGPU) {
    statusEl.textContent = "WebGPU를 지원하지 않습니다";
    statusEl.style.setProperty("--before-bg", "var(--error)");
    if (sendBtn) sendBtn.disabled = true;
    return;
  }

  if (isEngineLoading) {
    const progressPercent = (engineLoadingProgress?.progress ?? 0) * 100;
    const progressText = `[WebLLM] 사전 캐시: ${engineLoadingProgress?.text ?? "준비 중..."} (${progressPercent.toFixed(1)}%)`;
    statusEl.textContent = progressText;
    statusEl.style.setProperty("--before-bg", "var(--warning)");
    if (sendBtn) sendBtn.disabled = true;

    const container = document.querySelector(".web-llm-chat-container");
    if (container) {
      if (!loadingMessageEl || !document.contains(loadingMessageEl)) {
        loadingMessageEl = renderChatMessage("system", progressText);
      } else {
        loadingMessageEl.innerHTML = formatChatMessage(progressText);
      }
    }

    const progressBar = document.getElementById("llm-progress-bar");
    const progressFill = document.getElementById("llm-progress-fill");
    if (progressBar && progressFill) {
      progressBar.style.display = "block";
      progressFill.style.width = `${(engineLoadingProgress?.progress || 0) * 100}%`;
    }
    return;
  } else {
    const progressBar = document.getElementById("llm-progress-bar");
    if (progressBar) progressBar.style.display = "none";

    if (loadingMessageEl) {
      loadingMessageEl.textContent = `${preset?.label || "모델"} 로딩 완료!`;
      loadingMessageEl = null;
    }
  }

  const installState = await getInstallState(modelId);

  if (installState.kind === "installed") {
    statusEl.textContent = `준비됨: ${preset?.label || modelId}`;
    statusEl.style.setProperty("--before-bg", "var(--success)");
    if (sendBtn && !isGenerating) sendBtn.disabled = false;
  } else if (installState.kind === "not-installed") {
    statusEl.textContent = `설치 필요: ${preset?.label || modelId}`;
    statusEl.style.setProperty("--before-bg", "var(--warning)");
    if (sendBtn) sendBtn.disabled = true;
  } else {
    statusEl.textContent = installState.message || "상태 확인 실패";
    statusEl.style.setProperty("--before-bg", "var(--error)");
  }
}

/**
 * Format chat text into sanitized HTML suitable for rendering.
 *
 * Escapes HTML characters, converts newlines to `<br>`, renders `**bold**` and `*italic*`, and turns links in the form `[text](jumpToId:<id>)` into anchors that call `window.findItem(id)` when clicked.
 * @param {string} content - Raw chat message text that may include newlines, `**bold**`, `*italic*`, and `jumpToId` links.
 * @returns {string} The resulting sanitized HTML string.
 */
function formatChatMessage(content) {
  if (!content) return "";

  let html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const jumpRegex = /\[([^\]]+)\]\s*\(jumpToId:\s*(\d+)\s*\)/gi;
  html = html.replace(jumpRegex, (match, text, id) => {
    return `<a href="#" class="jump-link" onclick="event.preventDefault(); if(window.findItem) window.findItem('${id}'); return false;">${text}</a>`;
  });

  return html;
}

/**
 * Render a chat message into the chat container and scroll to the bottom.
 * @param {string} role - Message role used for styling (e.g., `'user'`, `'assistant'`, or `'system'`); applied as a CSS class on the message element.
 * @param {string} content - Message content in plain text or markdown-like syntax accepted by formatChatMessage.
 * @returns {HTMLElement|undefined} The appended message element, or `undefined` if the chat container is not found.
 */
function renderChatMessage(role, content) {
  const container = document.querySelector(".web-llm-chat-container");
  if (!container) return;

  const msgEl = document.createElement("div");
  msgEl.className = `chat-message ${role}`;
  msgEl.innerHTML = formatChatMessage(content);

  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;

  return msgEl;
}

/**
 * Submit the current textarea message, perform a retrieval-augmented search for context, stream the model response, and update the chat UI and history.
 *
 * Validates and clears the input, prevents concurrent generation or engine loading, renders the user's message and an assistant placeholder, invokes the model with found context items, updates the assistant element with streaming partial and final responses, records the assistant reply in chat history, and displays any errors inline. The function is a no-op when the input is empty or when a generation or engine load is already in progress.
 */
async function handleChatSubmit() {
  const textarea = document.querySelector(".web-llm-textarea");
  const sendBtn = document.querySelector(".web-llm-send-btn");

  if (!textarea || isGenerating || isEngineLoading) return;

  const message = textarea.value.trim();
  if (!message) return;

  textarea.value = "";
  isGenerating = true;
  if (sendBtn) sendBtn.disabled = true;

  renderChatMessage("user", message);
  chatHistory.push({ role: "user", content: message });

  const assistantEl = renderChatMessage("assistant", "생각 중...");

  try {
    const relevantItems = searchItemsForContext(message);

    let contextItems = relevantItems;
    let isFallback = false;

    if (contextItems.length === 0) {
      // getVisibleItems 제거됨
    }

    if (contextItems.length > 0) {
      logger.log(
        "WebLLM",
        `RAG 검색: "${message}" -> ${contextItems.length}개 아이템 발견${isFallback ? " (현재 화면 기준)" : ""}`,
      );

      console.log(
        `%c[RAG Context] "${message}" -> ${contextItems.length}개 주입`,
        "color: #4CAF50; font-weight: bold;",
      );
      console.table(
        contextItems.map((item, idx) => ({
          No: idx + 1,
          이름: item.nameKo || getInfoKorean(item.id) || item.name || item.id,
          지역: state.koDict?.[item.region] || item.region || "알 수 없음",
          카테고리: getCategoryKorean(item.category),
          카테고리ID: item.category,
          설명: item.description?.replace(/<[^>]*>/g, " ").trim() || "-",
        })),
      );
    } else {
      logger.log("WebLLM", `RAG 검색: "${message}" -> 관련 아이템 없음`);
    }

    const thinkingEnabled = await isThinkingEnabled();

    await sendChatMessage(message, {
      items: contextItems,
      enableThinking: thinkingEnabled,
      onStream: ({ content }) => {
        if (assistantEl) {
          assistantEl.innerHTML = formatChatMessage(content || "생각 중...");
          const container = document.querySelector(".web-llm-chat-container");
          if (container) container.scrollTop = container.scrollHeight;
        }
      },
      onComplete: (result) => {
        if (assistantEl) {
          assistantEl.innerHTML = formatChatMessage(result.content);
        }
        chatHistory.push({ role: "assistant", content: result.content });
      },
      onError: (e) => {
        if (assistantEl) {
          assistantEl.textContent = `오류: ${e.message}`;
          assistantEl.classList.add("error");
        }
      },
    });
  } finally {
    isGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
    textarea.focus();
  }
}

/**
 * Register UI event handlers for the WebLLM modal and chat controls.
 *
 * Initializes:
 * - Click handler on the send button to submit the chat input.
 * - Ctrl/Cmd+Enter keyboard shortcut on the chat textarea to submit.
 * - Click handler on the modal close control to close the WebLLM modal.
 * - Model selection dropdown: populates options from MODEL_PRESETS, sets the stored value,
 *   and handles changes by persisting the selection, emitting a system message, updating UI state,
 *   and initiating model precaching with progress/completion/error callbacks that refresh UI status.
 */
async function setupEventListeners() {
  const sendBtn = document.querySelector(".web-llm-send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", handleChatSubmit);
  }

  const textarea = document.querySelector(".web-llm-textarea");
  if (textarea) {
    textarea.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleChatSubmit();
      }
    });
  }

  const closeBtn = document.querySelector(
    '[data-action="close-web-llm-modal"]',
  );
  if (closeBtn) {
    closeBtn.addEventListener("click", closeWebLLMModal);
  }

  const modelSelect = document.getElementById("web-llm-model-select");
  if (modelSelect) {
    modelSelect.innerHTML = MODEL_PRESETS.map(
      (p) => `<option value="${p.id}">${p.label}</option>`,
    ).join("");

    modelSelect.value = await getStoredModelId();

    modelSelect.addEventListener("change", async (e) => {
      const newModelId = e.target.value;
      const preset = MODEL_PRESETS.find((p) => p.id === newModelId);

      const { primaryDb } = await import("./storage/db.js");
      primaryDb.set(STORAGE_KEYS.MODEL_ID, newModelId).catch(console.warn);

      renderChatMessage(
        "system",
        `모델을 ${preset?.label || "알 수 없음"}으로 변경합니다. 로딩을 기다려주세요...`,
      );
      loadingMessageEl = null;

      updateUIStatus();

      preCacheModel({
        modelId: newModelId,
        onProgress: () => updateUIStatus(),
        onComplete: () => updateUIStatus(),
        onError: () => updateUIStatus(),
      });
    });
  }
}

/**
 * Initialize the WebLLM UI, event listeners, and data subscriptions.
 *
 * Sets up UI event handlers, subscribes to changes for `mapData` and `koDict`
 * to populate ID-to-Korean maps, and marks the module as initialized. Calling
 * this function multiple times is idempotent; subsequent calls return the
 * same initialization promise.
 *
 * @returns {Promise<void>} A promise that resolves when initialization completes.
 */
export async function initWebLLM() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (isInitialized) return;

    logger.log("WebLLM", "WebLLM 초기화 시작");

    await setupEventListeners();

    subscribe("mapData", () => {
      initializeIdMaps();
    });

    subscribe("koDict", () => {
      initializeIdMaps();
    });

    isInitialized = true;
    logger.success("WebLLM", "WebLLM 초기화 완료");
  })();

  return initPromise;
}

export {
  MODEL_PRESETS,
  getStoredModelId,
  getInstallState,
  checkWebGPUSupport,
  hasModelInCache,
  getOrCreateEngine,
  mlcEngine,
  isEngineLoading,
  engineLoadingProgress,
  setThinkingEnabled,
  isThinkingEnabled,
};

export default {
  initWebLLM,
  openWebLLMModal,
  closeWebLLMModal,
  preCacheModel,
  schedulePreCache,
  sendChatMessage,
  interruptGeneration,
  resetChat,
  getCategoryKorean,
  getInfoKorean,
  itemToRAGText,
  itemsToContext,
  MODEL_PRESETS,
  getStoredModelId,
  getInstallState,
  checkWebGPUSupport,
  setThinkingEnabled,
  isThinkingEnabled,
};
};
