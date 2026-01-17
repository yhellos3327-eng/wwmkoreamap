/**
 * WebLLM RAG Module - 사전 캐시 + 완전한 후처리 로직
 * 참조: backup/cf6688bd817a6c00.js, backup/537384ee85d67bd9.js
 */

import { state, subscribe } from "./state.js";
import { logger } from "./logger.js";
import { spatialIndex } from "./map/SpatialIndex.js";
import { webWorkerManager } from "./web-worker-manager.js";

// ============================================================================
// 상수 및 설정
// ============================================================================
const STORAGE_KEYS = {
  MODEL_ID: "wwm_webllm_model_id",
  AUTO_MODEL: "wwm_webllm_auto_model",
  THINKING_ENABLED: "wwm_webllm_thinking",
  SHOW_THINKING: "wwm_webllm_show_thinking",
  CUSTOM_MODELS: "wwm_webllm_custom_models",
  PRE_CACHE_DONE: "wwm_webllm_precache_done",
};

// 기본 모델 프리셋
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

// LLM 파라미터
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

// ============================================================================
// 엔진 상태 관리
// ============================================================================
let webllmModule = null;
let mlcEngine = null;
let currentModelId = null;
let isEngineLoading = false;
let engineLoadingProgress = { progress: 0, text: "" };
let isPreCacheInProgress = false;
let loadingMessageEl = null;

// ============================================================================
// 카테고리/정보 ID 후처리 맵
// ============================================================================
const categoryIdToKoreanMap = new Map();
const infoIdToKoreanMap = new Map();

/**
 * 카테고리/정보 ID 맵 초기화
 * state.koDict와 state.categoryItemTranslations를 기반으로 맵 생성
 */
function initializeIdMaps() {
  categoryIdToKoreanMap.clear();
  infoIdToKoreanMap.clear();

  // koDict에서 카테고리 및 아이템 번역 수집
  if (state.koDict) {
    for (const [key, value] of Object.entries(state.koDict)) {
      if (key && value) {
        // 카테고리 ID인지 아이템 ID인지 파악하여 분류
        categoryIdToKoreanMap.set(key, value);
        infoIdToKoreanMap.set(key, value);
      }
    }
  }

  // categoryItemTranslations에서 더 상세한 정보 수집
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

  // mapData.categories에서 카테고리 정보 수집
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

  // mapData.items에서 아이템 정보 수집
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
 * 정보 ID를 한국어 이름으로 변환
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
 * 아이템 데이터를 RAG용 텍스트로 변환 (완전한 한국어 후처리)
 */
export function itemToRAGText(item) {
  if (!item) return "";

  const parts = [];

  // 아이템 ID 및 이름 (Nullish coalescing으로 정확한 fallback)
  if (item.id) parts.push(`ID: ${item.id}`);
  const name = item.nameKo ?? getInfoKorean(item.id) ?? item.name ?? item.id;
  if (name) parts.push(`이름/NPC: ${name}`);

  // 카테고리
  if (item.category) {
    const catKorean = getCategoryKorean(item.category);
    parts.push(`카테고리: ${catKorean}`);
  }

  // 지역
  if (item.regionName || item.region) {
    const region = item.regionName || item.region;
    const regionKorean = state.koDict?.[region] || region;
    parts.push(`지역: ${regionKorean}`);
  }

  // 좌표
  if (item.x !== undefined && item.y !== undefined) {
    parts.push(`좌표: [${item.x.toFixed(4)}, ${item.y.toFixed(4)}]`);
  }

  // 설명
  if (item.description) {
    // HTML 태그 제거
    const desc = item.description.replace(/<[^>]*>/g, " ").trim();
    if (desc) parts.push(`설명: ${desc}`);
  }

  return parts.join(" | ");
}

/**
 * 여러 아이템을 컨텍스트 문자열로 변환
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

// ============================================================================
// WebGPU 및 모델 캐시 관련
// ============================================================================

/**
 * WebGPU 지원 여부 확인
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
 * WebLLM 모듈 동적 로드
 */
async function loadWebLLMModule() {
  if (webllmModule) return webllmModule;

  try {
    // CDN에서 web-llm 로드
    webllmModule = await import("https://esm.run/@mlc-ai/web-llm@0.2.78");
    logger.success("WebLLM", "WebLLM 모듈 로드 완료");
    return webllmModule;
  } catch (e) {
    logger.error("WebLLM", "WebLLM 모듈 로드 실패:", e);
    throw e;
  }
}

/**
 * 모델이 캐시에 있는지 확인
 */
async function hasModelInCache(modelId) {
  try {
    const module = await loadWebLLMModule();
    if (!module.hasModelInCache) {
      // 폴백: Cache API 직접 확인
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
 * 현재 설정된 모델 ID 가져오기
 */
function getStoredModelId() {
  const stored = localStorage.getItem(STORAGE_KEYS.MODEL_ID);
  if (stored && MODEL_PRESETS.some((p) => p.id === stored)) {
    return stored;
  }
  return DEFAULT_MODEL_ID;
}

/**
 * 모델 설치 상태 확인
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

// ============================================================================
// 엔진 관리 및 사전 캐시
// ============================================================================

/**
 * 진행 상태 콜백 생성
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
 * 엔진 생성 또는 재사용
 */
async function getOrCreateEngine(modelId, onProgress) {
  if (isEngineLoading) {
    throw new Error("엔진이 이미 로딩 중입니다");
  }

  // 같은 모델이 이미 로드되어 있으면 재사용
  if (mlcEngine && currentModelId === modelId) {
    return mlcEngine;
  }

  isEngineLoading = true;

  try {
    const module = await loadWebLLMModule();

    // 기존 엔진이 있으면 언로드
    if (mlcEngine && currentModelId !== modelId) {
      try {
        await mlcEngine.unload();
      } catch (e) {
        logger.warn("WebLLM", "기존 엔진 언로드 실패:", e);
      }
    }

    // Web Worker 기반 엔진 생성
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
 * 사전 캐시 - 페이지 로드 시 호출하여 모델을 미리 준비
 * 이렇게 하면 채팅 시작 시 대기열이 없음
 */
export async function preCacheModel(options = {}) {
  const { force = false, onProgress, onComplete, onError } = options;

  // 이미 사전 캐시가 진행 중이면 스킵
  if (isPreCacheInProgress) {
    logger.log("WebLLM", "사전 캐시 이미 진행 중");
    return;
  }

  // WebGPU 지원 확인
  const hasWebGPU = await checkWebGPUSupport();
  if (!hasWebGPU) {
    logger.warn("WebLLM", "WebGPU 미지원, 사전 캐시 스킵");
    return;
  }

  const modelId = getStoredModelId();

  // 강제가 아니면 캐시 확인
  if (!force) {
    const cached = await hasModelInCache(modelId);
    if (cached) {
      logger.log("WebLLM", `모델 이미 캐시됨: ${modelId}`);
      // 캐시된 경우에도 엔진 워밍업
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
    localStorage.setItem(STORAGE_KEYS.PRE_CACHE_DONE, "true");
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
 * 백그라운드 사전 캐시 - requestIdleCallback 사용
 */
export function schedulePreCache(options = {}) {
  const { delay = 5000 } = options;

  // 지연 후 idle 시점에 실행
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
 * 현재 지도 화면에 보이는 아이템들을 가져옵니다.
 */
function getVisibleItems() {
  if (!state.map || !spatialIndex) return [];
  try {
    const bounds = state.map.getBounds();
    return spatialIndex.getItemsInBounds(bounds, 0);
  } catch (e) {
    logger.warn("WebLLM", "가시 아이템 획득 실패:", e);
    return [];
  }
}

// ============================================================================
// 검색 및 RAG 관련
// ============================================================================

/**
 * 사용자 쿼리에 기반하여 관련 아이템 검색 (RAG)
 */
function searchItemsForContext(query) {
  if (!state.mapData?.items) return [];

  const queryLower = query.toLowerCase().trim();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length >= 1);

  // 1. 가시성 기반 검색 (현재 화면, 여기, 이 근처 등)
  const visibilityKeywords = ["여기", "현재", "화면", "보이는", "근처", "이곳"];
  const isVisibilityQuery = visibilityKeywords.some((k) =>
    queryLower.includes(k),
  );
  const visibleItems = getVisibleItems();

  // 2. 지역명 추출 (번역명 대응)
  let targetRegion = null;
  if (state.uniqueRegions) {
    for (const region of state.uniqueRegions) {
      if (!region) continue;
      const regionLower = region.toLowerCase();
      const regionKo = (state.koDict?.[region] || region).toLowerCase();

      if (queryLower.includes(regionLower) || queryLower.includes(regionKo)) {
        targetRegion = region; // 원본 지역명 저장
        break;
      }
    }
  }

  // 3. 카테고리 및 특정 아이템 키워드 추출
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

  // 4. 정밀 필터링 전략
  let results = [];

  if (targetRegion || targetKeyword || isVisibilityQuery) {
    const basePool =
      isVisibilityQuery && visibleItems.length > 0
        ? visibleItems
        : state.mapData.items;

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
        // '상자' 검색 시 이름이나 카테고리에 '상자'가 포함된 경우만 매칭 (설명 제외)
        // 단, 설명에만 상자가 있는 경우는 '관련 아이템'으로는 볼 수 있지만 '상자' 자체는 아님
        const nameMatch = nameKo.includes(targetKeyword);
        const categoryMatch = categoryKo.includes(targetKeyword);

        // 특정 카테고리 ID 매칭 (상자: 17310010006, 17310010007 등)
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
          // 다른 키워드는 설명 포함 허용
          keywordMatch =
            keywordMatch ||
            (item.description && item.description.includes(targetKeyword));
        }

        if (!keywordMatch) return false;
        match = true;
      }

      // 추가 키워드 (지상, 지하 등)
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

  // 5. 점수 기반 검색 (폴백)
  // 쿼리가 너무 짧으면 폴백하지 않음
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
      if (name.includes(term)) score += 10;
      if (region.includes(term)) score += 8;
      if (category.includes(term)) score += 12;
      if (desc.includes(term)) score += 3;
      if (item.id && String(item.id).includes(term)) score += 15;
    });

    return { item, score };
  });

  results = scoredItems
    .filter((entry) => entry.score > 10) // 문턱값 상향
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((entry) => entry.item);

  return results;
}

// ============================================================================
// 채팅 관련
// ============================================================================

/**
 * 시스템 프롬프트 생성
 */
function buildSystemPrompt(context) {
  const mapKey = state.currentMapKey ?? "qinghe";
  const mapName = state.koDict?.[mapKey] ?? mapKey;

  // 모델 크기에 따라 프롬프트 전략 수정 (0.5B 등 작은 모델은 단순하고 명확한 지시가 필요)
  const isSmallModel = currentModelId && currentModelId.includes("0.5B");

  if (isSmallModel) {
    return `당신은 ${mapName} 지도 도우미입니다. 반드시 다음 규칙을 지켜 한국어로 답변하세요.

## 데이터
${context}

## 규칙
1. 아이템 개수를 가장 먼저 말하세요.
2. [아이템이름](jumpToId:ID) 형식의 링크를 반드시 포함하세요.
3. 아이템 설명과 NPC 이름을 포함하세요.
4. 모르는 내용은 모른다고 하세요.

## 답변 예시
"완석포에 1개의 낚시터가 있습니다. 
- [초수양](jumpToId:181105668096) (NPC): 아이 앞에서 태극권을 사용하세요."`;
  }

  return `당신은 ${mapName} 지도의 도우미 AI입니다.
사용자가 특정 위치나 아이템에 대해 질문하면, 아래 컨텍스트를 참고하여 한국어로 친절하게 답변하세요.

## 현재 지도 정보 (검색 결과)
${context}

## 지침
- 질문과 관련된 아이템이 몇 개인지 수량을 먼저 언급하세요 (예: "완석포 지역에는 2개의 낚시 포인트가 있습니다.")
- 위치 정보를 제공할 때는 반드시 \`[아이템이름](jumpToId:아이템ID)\` 형식을 사용하여 사용자가 바로 이동할 수 있게 하세요. (예: "[초수양](jumpToId:181105668096)")
- 아이템의 '이름/NPC' 필드는 해당 위치에 있는 NPC의 이름일 가능성이 높습니다.
- 아이템의 '설명' 정보가 있다면 반드시 답변에 포함하세요.
- 찾을 수 없는 정보는 솔직히 모른다고 말하세요
- 항상 한국어로 답변하세요`;
}

/**
 * 채팅 메시지 전송
 */
export async function sendChatMessage(userMessage, options = {}) {
  const {
    items = [],
    onStream,
    onComplete,
    onError,
    enableThinking = false,
  } = options;

  // ID 맵 초기화 확인
  if (categoryIdToKoreanMap.size === 0) {
    initializeIdMaps();
  }

  // 컨텍스트 생성 (토큰 제한 고려하여 15개로 제한)
  const context = itemsToContext(items, 15);

  // 엔진 확보
  const modelId = getStoredModelId();
  let engine;

  try {
    engine = await getOrCreateEngine(modelId);
  } catch (e) {
    if (onError) onError(e);
    throw e;
  }

  // 모델 프리셋 확인
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

        // <think> 태그 처리
        if (supportsThinking) {
          while (true) {
            if (!inThinking) {
              const startIdx = buffer.indexOf("<think>");
              if (startIdx !== -1) {
                // <think> 이전 내용은 fullContent에
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
 * 생성 중단
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
 * 채팅 리셋
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

// ============================================================================
// UI 관련
// ============================================================================

let chatHistory = [];
let isGenerating = false;

/**
 * WebLLM 모달 열기
 */
export async function openWebLLMModal() {
  const modal = document.getElementById("web-llm-modal");
  if (!modal) return;

  modal.classList.remove("hidden");

  // ID 맵 초기화
  initializeIdMaps();

  // 상태 업데이트
  await updateUIStatus();

  // 입력 포커스
  const textarea = modal.querySelector(".web-llm-textarea");
  if (textarea) textarea.focus();
}

/**
 * WebLLM 모달 닫기
 */
export function closeWebLLMModal() {
  const modal = document.getElementById("web-llm-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  interruptGeneration();
}

/**
 * UI 상태 업데이트
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

  // 로딩 중인 경우
  if (isEngineLoading) {
    const progressPercent = (engineLoadingProgress?.progress ?? 0) * 100;
    const progressText = `[WebLLM] 사전 캐시: ${engineLoadingProgress?.text ?? "준비 중..."} (${progressPercent.toFixed(1)}%)`;
    statusEl.textContent = progressText;
    statusEl.style.setProperty("--before-bg", "var(--warning)");
    if (sendBtn) sendBtn.disabled = true;

    // 채팅창에 로딩 메시지 업데이트
    const container = document.querySelector(".web-llm-chat-container");
    if (container) {
      // loadingMessageEl이 없거나 문서에서 제거된 경우 새로 생성
      if (!loadingMessageEl || !document.contains(loadingMessageEl)) {
        loadingMessageEl = renderChatMessage("system", progressText);
      } else {
        loadingMessageEl.innerHTML = formatChatMessage(progressText);
      }
    }

    // 진행바 표시
    const progressBar = document.getElementById("llm-progress-bar");
    const progressFill = document.getElementById("llm-progress-fill");
    if (progressBar && progressFill) {
      progressBar.style.display = "block";
      progressFill.style.width = `${(engineLoadingProgress?.progress || 0) * 100}%`;
    }
    return;
  } else {
    // 진행바 숨김
    const progressBar = document.getElementById("llm-progress-bar");
    if (progressBar) progressBar.style.display = "none";

    // 로딩 메시지 완료 처리
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
    if (sendBtn && !isGenerating) sendBtn.disabled = false;
  } else {
    statusEl.textContent = installState.message || "상태 확인 실패";
    statusEl.style.setProperty("--before-bg", "var(--error)");
  }
}

/**
 * 채팅 메시지 마크다운 및 특수 링크 파싱
 */
function formatChatMessage(content) {
  if (!content) return "";

  let html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  // 1. 굵게 (**text**)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // 2. 기울임 (*text*)
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // 3. findItem 링크 파싱 ([텍스트](jumpToId:ID)) - 대소문자 구분 없음, ]와 ( 사이 공백 허용
  const jumpRegex = /\[([^\]]+)\]\s*\(jumpToId:\s*(\d+)\s*\)/gi;
  html = html.replace(jumpRegex, (match, text, id) => {
    return `<a href="#" class="jump-link" onclick="event.preventDefault(); if(window.findItem) window.findItem('${id}'); return false;">${text}</a>`;
  });

  return html;
}

/**
 * 채팅 메시지 렌더링
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
 * 채팅 전송 핸들러
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

  // 사용자 메시지 표시
  renderChatMessage("user", message);
  chatHistory.push({ role: "user", content: message });

  // 어시스턴트 메시지 요소 생성
  const assistantEl = renderChatMessage("assistant", "생각 중...");

  try {
    // RAG: 질문과 관련된 아이템 검색
    const relevantItems = searchItemsForContext(message);

    // 검색 결과가 있으면 해당 결과 사용
    // 만약 검색 결과가 전혀 없다면, 현재 화면에 보이는 아이템이라도 제공 (최대 10개)
    let contextItems = relevantItems;
    let isFallback = false;

    if (contextItems.length === 0) {
      const visible = getVisibleItems();
      if (visible.length > 0) {
        contextItems = visible.slice(0, 10);
        isFallback = true;
      }
    }

    if (contextItems.length > 0) {
      logger.log(
        "WebLLM",
        `RAG 검색: "${message}" -> ${contextItems.length}개 아이템 발견${isFallback ? " (현재 화면 기준)" : ""}`,
      );

      // 콘솔에 상세 정보 출력 (유지)
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

    // AI 답변 생성 복구
    await sendChatMessage(message, {
      items: contextItems,
      enableThinking:
        localStorage.getItem(STORAGE_KEYS.THINKING_ENABLED) === "true",
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
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 전송 버튼
  const sendBtn = document.querySelector(".web-llm-send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", handleChatSubmit);
  }

  // 텍스트 영역 엔터키
  const textarea = document.querySelector(".web-llm-textarea");
  if (textarea) {
    textarea.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleChatSubmit();
      }
    });
  }

  // 닫기 버튼
  const closeBtn = document.querySelector(
    '[data-action="close-web-llm-modal"]',
  );
  if (closeBtn) {
    closeBtn.addEventListener("click", closeWebLLMModal);
  }

  // 모델 선택
  const modelSelect = document.getElementById("web-llm-model-select");
  if (modelSelect) {
    // 옵션 채우기
    modelSelect.innerHTML = MODEL_PRESETS.map(
      (p) => `<option value="${p.id}">${p.label}</option>`,
    ).join("");

    modelSelect.value = getStoredModelId();

    modelSelect.addEventListener("change", (e) => {
      const newModelId = e.target.value;
      const preset = MODEL_PRESETS.find((p) => p.id === newModelId);
      localStorage.setItem(STORAGE_KEYS.MODEL_ID, newModelId);

      // 채팅창에 로그 출력
      renderChatMessage(
        "system",
        `모델을 ${preset?.label || "알 수 없음"}으로 변경합니다. 로딩을 기다려주세요...`,
      );
      loadingMessageEl = null; // 새로운 로딩 메시지 생성을 위해 초기화

      // 즉시 상태 업데이트
      updateUIStatus();

      // 자동 다운로드 시작 (캐시 없으면)
      preCacheModel({
        modelId: newModelId,
        onProgress: () => updateUIStatus(), // 진행 상황 UI 반영
        onComplete: () => updateUIStatus(),
        onError: () => updateUIStatus(),
      });
    });
  }
}

// ============================================================================
// 초기화
// ============================================================================

/**
 * WebLLM 모듈 초기화
 */
export async function initWebLLM() {
  logger.log("WebLLM", "WebLLM 초기화 시작");

  // 이벤트 리스너 설정
  setupEventListeners();

  // state 변경 구독
  subscribe("mapData", () => {
    initializeIdMaps();
  });

  subscribe("koDict", () => {
    initializeIdMaps();
  });

  // 사전 캐시 스케줄링 (페이지 로드 후 5초 뒤 idle 시점에)
  schedulePreCache({
    delay: 5000,
    onProgress: (p) => {
      logger.log(
        "WebLLM",
        `사전 캐시: ${p.text} (${(p.progress * 100).toFixed(1)}%)`,
      );
      updateUIStatus(); // UI 실시간 업데이트 추가
    },
    onComplete: () => {
      logger.success("WebLLM", "사전 캐시 완료");
      updateUIStatus();
    },
    onError: (e) => {
      logger.warn("WebLLM", "사전 캐시 실패:", e.message);
    },
  });

  logger.success("WebLLM", "WebLLM 초기화 완료");
}

// ============================================================================
// 외부 API
// ============================================================================

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
};

// 기본 내보내기
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
};
