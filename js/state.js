import { createStore } from "https://esm.run/zustand@4.5.0/vanilla";
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

const initialState = {
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

  savedAIProvider: localStorage.getItem("wwm_ai_provider") ?? "gemini",
  savedGeminiKey: storage.getApiKey("wwm_api_key", ""),
  savedOpenAIKey: storage.getApiKey("wwm_openai_key", ""),
  savedClaudeKey: storage.getApiKey("wwm_claude_key", ""),
  savedApiModel: localStorage.getItem("wwm_api_model") ?? "gemini-1.5-flash",
  savedRegionColor: localStorage.getItem("wwm_region_color") ?? "#242424",
  savedRegionFillColor:
    localStorage.getItem("wwm_region_fill_color") ?? "#ffbd53",
  hideCompleted: localStorage.getItem("wwm_hide_completed") === "true",
  enableClustering: localStorage.getItem("wwm_enable_clustering") === "true",
  enableWebLLM: localStorage.getItem("wwm_enable_web_llm") === "true",
  currentGuideStep: 0,
  rawCSV: null,
  parsedCSV: null,
  isDevMode: false,
  savedGpuSetting: localStorage.getItem("wwm_gpu_setting") ?? "auto",
  savedMenuPosition: localStorage.getItem("wwm_menu_position") ?? "center",
  useChromeTranslator:
    localStorage.getItem("wwm_use_chrome_translator") === "true",
  disableRegionClickPan:
    localStorage.getItem("wwm_disable_region_click_pan") === "true",

  get gpuRenderMode() {
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

const store = createStore(() => initialState);

// Proxy to maintain backward compatibility with direct state access/mutation
export const state = new Proxy(
  {},
  {
    get: (target, prop) => {
      return store.getState()[prop];
    },
    set: (target, prop, value) => {
      const oldValue = store.getState()[prop];
      store.setState({ [prop]: value });
      logger.stateChange(prop, oldValue, value);
      return true;
    },
  },
);

let categoryMapCache = null;

export const getCategoryMap = () => {
  const mapData = store.getState().mapData;
  if (!mapData?.categories?.length) return null;

  if (
    !categoryMapCache ||
    categoryMapCache.size !== mapData.categories.length
  ) {
    categoryMapCache = new Map(mapData.categories.map((c) => [c.id, c]));
  }
  return categoryMapCache;
};

export const invalidateCategoryMapCache = () => {
  categoryMapCache = null;
};

export const subscribe = (key, callback) => {
  return store.subscribe((state, prevState) => {
    if (state[key] !== prevState[key]) {
      callback(state[key]);
    }
  });
};

// Removed subscribeWeak as it was unused

export const unsubscribeAll = (key) => {
  // Zustand handles unsubscription via the returned function from subscribe.
  // This function is kept for API compatibility but might be no-op or need refactoring if used.
  // Since we don't track listeners manually anymore, we can't "unsubscribe all" for a key easily
  // without wrapping subscribe.
  // Assuming this is rarely used or can be ignored for now.
  console.warn("unsubscribeAll is deprecated with Zustand implementation");
};

export const notify = (key, value, oldValue) => {
  // Manually trigger an update if needed (rarely used with Zustand)
  // With Zustand, we usually just setState.
  // If we need to force notify, we might need to hack it or just rely on setState.
  logger.stateChange(key, oldValue, value);
  // We can't easily force notify specific listeners without changing state.
};

export const setState = (key, value) => {
  state[key] = value; // Goes through Proxy
};

export const getState = (key) => {
  return store.getState()[key];
};

export const updateState = (updates) => {
  store.setState(updates);
  Object.keys(updates).forEach((key) => {
    // Logging is handled by the Proxy if we went through it, but here we bypass Proxy for batch update.
    // So we might want to log here if needed.
  });
};

export const setDeep = (path, value) => {
  const keys = path.split(".");
  if (keys.length === 1) {
    setState(keys[0], value);
    return;
  }

  // For deep updates, we need to clone the path to ensure immutability if we want to be pure,
  // but for compatibility we might just mutate and trigger update.
  // However, Zustand prefers immutable updates.

  const rootKey = keys[0];
  const rootValue = store.getState()[rootKey];

  // Helper to deep clone/update
  const deepUpdate = (obj, pathKeys, val) => {
    if (pathKeys.length === 0) return val;
    const [current, ...rest] = pathKeys;
    // Handle case where obj is undefined/null
    const safeObj = obj ?? {};
    const newObj = Array.isArray(safeObj) ? [...safeObj] : { ...safeObj };
    newObj[current] = deepUpdate(safeObj[current], rest, val);
    return newObj;
  };

  const newRootValue = deepUpdate(rootValue, keys.slice(1), value);

  // Trigger update for the root key
  store.setState({ [rootKey]: newRootValue });

  // Also notify via logger
  logger.stateChange(rootKey, rootValue, newRootValue);
};

export const dispatch = (actionType, payload) => {
  logger.log("State", `Dispatching Action: ${actionType}`, payload);

  switch (actionType) {
    case ACTIONS.SET_MAP:
      setState("currentMapKey", payload);
      break;
    case ACTIONS.SET_LOADING_STATE:
      setState("loadingState", {
        ...store.getState().loadingState,
        ...payload,
      });
      break;
    case ACTIONS.UPDATE_FILTER: {
      const { activeCategoryIds, activeRegionNames } = store.getState();
      if (payload.type === "category") {
        if (payload.active) activeCategoryIds.add(payload.id);
        else activeCategoryIds.delete(payload.id);
        // Trigger update
        store.setState({ activeCategoryIds: new Set(activeCategoryIds) });
      } else if (payload.type === "region") {
        if (payload.active) activeRegionNames.add(payload.id);
        else activeRegionNames.delete(payload.id);
        // Trigger update
        store.setState({ activeRegionNames: new Set(activeRegionNames) });
      }
      break;
    }
    case ACTIONS.SET_DEV_MODE:
      setState("isDevMode", payload);
      break;
    default:
      console.warn(`Unknown action type: ${actionType}`);
  }
};

export { store };
