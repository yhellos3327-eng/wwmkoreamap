import { logger } from "./logger.js";
import { ACTIONS } from "./actions.js";
import { storage } from "./storage.js";

const checkWebGL = (() => {
  let supported = null;
  return () => {
    if (supported !== null) return supported;
    try {
      const canvas = document.createElement("canvas");
      supported = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
      if (supported) {
        const gl =
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl) gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    } catch (e) {
      supported = false;
    }
    return supported;
  };
})();

const state = {
  currentMapKey: "qinghe",
  currentTileLayer: null,
  regionLayerGroup: null,
  map: null,
  allMarkers: new Map(),
  pendingMarkers: [],
  regionData: [],
  koDict: {},
  mapData: { categories: [], items: [] },
  activeCategoryIds: new Set(),
  activeRegionNames: new Set(),
  uniqueRegions: new Set(),
  itemsByCategory: {},
  completedList: (() => {
    const stored = JSON.parse(localStorage.getItem("wwm_completed")) || [];
    if (stored.length > 0 && typeof stored[0] !== "object") {
      const migrated = stored.map((id) => ({ id, completedAt: null }));
      localStorage.setItem("wwm_completed", JSON.stringify(migrated));
      return migrated;
    }
    return stored;
  })(),
  favorites: JSON.parse(localStorage.getItem("wwm_favorites")) || [],
  categoryItemTranslations: {},
  currentModalList: [],
  currentLightboxImages: [],
  currentLightboxIndex: 0,
  currentLightboxMedia: [],
  showComments: localStorage.getItem("wwm_show_comments") !== "false",
  closeOnComplete: localStorage.getItem("wwm_close_on_complete") === "true",
  regionMetaInfo: {},
  reverseRegionMap: {},
  // Nullish coalescing으로 localStorage 기본값 설정 (null 처리)
  savedAIProvider: localStorage.getItem("wwm_ai_provider") ?? "gemini",
  savedGeminiKey: storage.getApiKey("wwm_api_key", ""),
  savedOpenAIKey: storage.getApiKey("wwm_openai_key", ""),
  savedClaudeKey: storage.getApiKey("wwm_claude_key", ""),
  savedApiModel: localStorage.getItem("wwm_api_model") ?? "gemini-1.5-flash",
  savedRegionColor: localStorage.getItem("wwm_region_color") ?? "#242424",
  savedRegionFillColor:
    localStorage.getItem("wwm_region_fill_color") ?? "#ffbd53",
  hideCompleted: localStorage.getItem("wwm_hide_completed") === "true",
  enableClustering: localStorage.getItem("wwm_enable_clustering") !== "false",
  currentGuideStep: 0,
  rawCSV: null,
  parsedCSV: null,
  isDevMode: false,
  savedGpuSetting: localStorage.getItem("wwm_gpu_setting") ?? "auto",
  savedMenuPosition: localStorage.getItem("wwm_menu_position") ?? "center",
  useChromeTranslator:
    localStorage.getItem("wwm_use_chrome_translator") === "true",

  get gpuRenderMode() {
    // GPU 모드가 강제되므로 WebGL 가용 여부를 직접 반환합니다.
    return checkWebGL();
  },
  set gpuRenderMode(value) {
    this.savedGpuSetting = value ? "on" : "off";
    localStorage.setItem("wwm_gpu_setting", this.savedGpuSetting);
  },
  pixiOverlay: null,
  pixiContainer: null,
  loadingState: {
    csvProgress: 0,
    mapProgress: 0,
    message: "초기화 중...",
    detail: "",
    isVisible: true,
  },
};

// 카테고리 Map 캐시 (O(1) 조회용)
let categoryMapCache = null;

/**
 * 카테고리 ID를 키로 하는 Map 반환 (O(1) 조회 가능)
 * mapData.categories가 변경되면 캐시가 무효화됨
 * @returns {Map<string, Object>|null} 카테고리 Map 또는 null
 */
export const getCategoryMap = () => {
  if (!state.mapData?.categories?.length) return null;

  // 캐시가 없거나 기존 캐시 크기와 다르면 재생성
  if (
    !categoryMapCache ||
    categoryMapCache.size !== state.mapData.categories.length
  ) {
    categoryMapCache = new Map(state.mapData.categories.map((c) => [c.id, c]));
  }
  return categoryMapCache;
};

/**
 * 카테고리 Map 캐시 무효화 (mapData 업데이트 시 호출)
 */
export const invalidateCategoryMapCache = () => {
  categoryMapCache = null;
};

const listeners = {};

/**
 * Subscribe to state changes with a strong reference.
 * Returns an unsubscribe function.
 */
export const subscribe = (key, callback) => {
  if (!listeners[key]) {
    listeners[key] = [];
  }
  listeners[key].push({ type: "strong", callback });

  return () => {
    if (!listeners[key]) return;
    const index = listeners[key].findIndex((l) => l.callback === callback);
    if (index > -1) {
      listeners[key].splice(index, 1);
    }
  };
};

/**
 * Subscribe to state changes with a weak reference to the owner.
 * This allows the owner to be garbage collected without manual unsubscribe.
 * @param {string} key - State key to subscribe to
 * @param {Object} owner - The object that owns the subscription (this)
 * @param {Function|string} callbackOrMethod - Callback function or method name on owner
 */
export const subscribeWeak = (key, owner, callbackOrMethod) => {
  if (!listeners[key]) {
    listeners[key] = [];
  }

  listeners[key].push({
    type: "weak",
    ownerRef: new WeakRef(owner),
    callbackOrMethod,
  });
};

export const unsubscribeAll = (key) => {
  if (listeners[key]) {
    listeners[key] = [];
  }
};

export const notify = (key, value, oldValue) => {
  logger.stateChange(key, oldValue, value);

  if (listeners[key]) {
    // Iterate backwards to allow safe removal
    for (let i = listeners[key].length - 1; i >= 0; i--) {
      const listener = listeners[key][i];

      if (listener.type === "strong") {
        listener.callback(value);
      } else if (listener.type === "weak") {
        const owner = listener.ownerRef.deref();
        if (owner) {
          if (typeof listener.callbackOrMethod === "string") {
            if (typeof owner[listener.callbackOrMethod] === "function") {
              owner[listener.callbackOrMethod](value);
            }
          } else if (typeof listener.callbackOrMethod === "function") {
            // CAUTION: If this function captures 'owner', it will prevent GC.
            // Ideally use method name or a function that doesn't capture 'this'.
            listener.callbackOrMethod.call(owner, value);
          }
        } else {
          // Owner collected, remove listener
          listeners[key].splice(i, 1);
          // console.log(`[State] Auto-unsubscribed collected listener for ${key}`);
        }
      } else {
        // Legacy support if any raw callbacks remain (shouldn't happen with new code)
        if (typeof listener === "function") listener(value);
      }
    }
  }
};

const stateProxy = new Proxy(state, {
  set(target, property, value) {
    const oldValue = target[property];
    target[property] = value;
    notify(property, value, oldValue);
    return true;
  },
});

export const setState = (key, value) => {
  stateProxy[key] = value;
};

export const getState = (key) => {
  return stateProxy[key];
};

export const updateState = (updates) => {
  Object.assign(stateProxy, updates);
};

export const setDeep = (path, value) => {
  const keys = path.split(".");
  let current = stateProxy;
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  const oldValue = current[lastKey];
  current[lastKey] = value;
  notify(keys[0], stateProxy[keys[0]], stateProxy[keys[0]]);
};

export const dispatch = (actionType, payload) => {
  logger.log("State", `Dispatching Action: ${actionType}`, payload);

  switch (actionType) {
    case ACTIONS.SET_MAP:
      setState("currentMapKey", payload);
      break;
    case ACTIONS.SET_LOADING_STATE:
      setState("loadingState", { ...state.loadingState, ...payload });
      break;
    case ACTIONS.UPDATE_FILTER:
      if (payload.type === "category") {
        if (payload.active) state.activeCategoryIds.add(payload.id);
        else state.activeCategoryIds.delete(payload.id);
        notify(
          "activeCategoryIds",
          state.activeCategoryIds,
          state.activeCategoryIds,
        );
      } else if (payload.type === "region") {
        if (payload.active) state.activeRegionNames.add(payload.id);
        else state.activeRegionNames.delete(payload.id);
        notify(
          "activeRegionNames",
          state.activeRegionNames,
          state.activeRegionNames,
        );
      }
      break;
    case ACTIONS.SET_DEV_MODE:
      setState("isDevMode", payload);
      break;
    default:
      console.warn(`Unknown action type: ${actionType}`);
  }
};

export { stateProxy as state };
