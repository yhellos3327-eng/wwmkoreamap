// @ts-check
const L = /** @type {any} */ (window).L;
import { resetGif } from "../utils.js";
import { state, setState } from "../state.js";
import { primaryDb } from "../storage/db.js";
import {
  renderQuestList,
  renderQuestDetail,
  updateStepHighlight,
} from "./renderer.js";
import { lazyLoader } from "../ui/lazy-loader.js";
import { MAP_CONFIGS } from "../config.js";

/** @type {Map<string, any>} */
const questCache = new Map();

/** @type {any} */
let questIndexCache = null;

/** @type {any} */
let questPolyline = null;

/** @type {any[]} */
let questBadgeMarkers = [];

/** @type {number} */
let currentStepIndex = 0;

/** @type {any} */
let currentQuestData = null;

/** @type {string} */
let currentFilter = "";

/**
 * Load quest index from JSON.
 * @returns {Promise<any>}
 */
const loadQuestIndex = async () => {
  if (questIndexCache) return questIndexCache;
  try {
    const res = await fetch("data/quests/index.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    questIndexCache = await res.json();
    return questIndexCache;
  } catch (err) {
    console.error("Failed to load quest index:", err);
    return { questLines: [], categories: [] };
  }
};

/**
 * Find quest line info for a specific marker.
 * @param {string|number} markerId
 * @returns {Promise<{id: string, title: string}|null>}
 */
export const findQuestLineForMarker = async (markerId) => {
  const index = await loadQuestIndex();

  const promises = index.questLines.map(ql => loadQuestLine(ql.id));
  const quests = await Promise.all(promises);

  for (const quest of quests) {
    if (!quest) continue;
    const hasStep = quest.steps.some(step => String(step.markerId) === String(markerId));
    if (hasStep) {
      return { id: quest.id, title: quest.title };
    }
  }
  return null;
};

/**
 * Load a specific quest line.
 * @param {string} id
 * @returns {Promise<any|null>}
 */
const loadQuestLine = async (id) => {
  if (questCache.has(id)) return questCache.get(id);
  try {
    const res = await fetch(`data/quests/${id}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    questCache.set(id, data);
    return data;
  } catch (err) {
    console.error(`Failed to load quest: ${id}`, err);
    return null;
  }
};

/**
 * Open the quest guide panel.
 * @param {string} [questLineId] - If provided, open detail view directly.
 */
export const openQuestGuide = async (questLineId) => {
  const panel = document.getElementById("quest-guide-panel");
  if (!panel) return;

  const arcaPanel = document.getElementById("arca-panel");
  if (arcaPanel) arcaPanel.classList.remove("open");

  if (window.innerWidth <= 768) {
    const { toggleSidebar } = await import("../ui.js");
    toggleSidebar("close");
  }

  panel.classList.add("open");
  setState("questGuideOpen", true);

  if (questLineId) {
    await showQuestDetail(questLineId);
  } else {
    await showQuestList();
  }

  setTimeout(() => {
    if (state.map) state.map.invalidateSize();
  }, 400);
};

/**
 * Close the quest guide panel.
 */
export const closeQuestGuide = () => {
  const panel = document.getElementById("quest-guide-panel");
  if (!panel) return;

  panel.classList.remove("open");
  setState("questGuideOpen", false);
  setState("currentQuestLineId", null);

  clearQuestLine();

  setState("activeQuestMarkerIds", new Set());
  triggerMarkerRerender();

  const backBtn = panel.querySelector(".quest-guide-back");
  const nav = document.getElementById("quest-guide-nav");
  if (backBtn) backBtn.classList.add("hidden");
  if (nav) nav.classList.add("hidden");

  const titleEl = document.getElementById("quest-guide-title");
  if (titleEl) titleEl.textContent = "퀘스트 가이드";

  currentQuestData = null;
  currentStepIndex = 0;

  if (stepObserver) stepObserver.disconnect();

  setTimeout(() => {
    if (state.map) state.map.invalidateSize();
  }, 400);
};

/**
 * Show the quest list view.
 */
const showQuestList = async () => {
  const index = await loadQuestIndex();
  const progress = state.questProgress || {};

  const panel = document.getElementById("quest-guide-panel");
  const backBtn = panel?.querySelector(".quest-guide-back");
  const nav = document.getElementById("quest-guide-nav");
  if (backBtn) backBtn.classList.add("hidden");
  if (nav) nav.classList.add("hidden");

  const currentMapKey = state.currentMapKey;
  const currentMapConfig = MAP_CONFIGS[currentMapKey];
  const mapName = currentMapConfig ? currentMapConfig.name : "";

  const titleEl = document.getElementById("quest-guide-title");
  if (titleEl) titleEl.textContent = mapName ? `${mapName} 퀘스트 가이드` : "퀘스트 가이드";

  const filteredQuestLines = index.questLines.filter(
    (ql) => !ql.mapKey || ql.mapKey === currentMapKey
  );

  renderQuestList(filteredQuestLines, index.categories, progress);
};

/**
 * Show quest detail view.
 * @param {string} questLineId
 */
const showQuestDetail = async (questLineId) => {
  const quest = await loadQuestLine(questLineId);
  if (!quest) return;

  currentQuestData = quest;
  currentStepIndex = 0;
  setState("currentQuestLineId", questLineId);

  const panel = document.getElementById("quest-guide-panel");
  const backBtn = panel?.querySelector(".quest-guide-back");
  if (backBtn) backBtn.classList.remove("hidden");
  const titleEl = document.getElementById("quest-guide-title");
  if (titleEl) titleEl.textContent = quest.title;

  const nav = document.getElementById("quest-guide-nav");
  if (nav && quest.steps.length > 1) {
    nav.classList.remove("hidden");
    updateNavIndicator();
  }

  updateQuestMarkers(quest);
  displayQuestLine(quest);

  const progress = state.questProgress || {};
  const completedSteps = progress[questLineId] || [];
  const options = state.questDisplayOptions || {
    showImages: true,
    showVideos: true,
    showMapCoords: true,
  };

  currentFilter = "";

  renderQuestDetail(
    quest,
    completedSteps,
    options,
    currentStepIndex,
    currentFilter,
  );
  const container = document.getElementById("quest-guide-content");
  if (container) lazyLoader.observeAll(".lazy-load", container);

  // Re-init scroll spy
  initScrollSpy();
};

/**
 * Update quest markers on map based on current filter.
 * @param {any} quest
 */
const updateQuestMarkers = (quest) => {
  const markerIds = new Set();
  quest.steps.forEach((step) => {
    if (step.markerId) {
      if (!currentFilter || step.group === currentFilter || step.group === "skill") {
        markerIds.add(String(step.markerId));
      }
    }
  });
  setState("activeQuestMarkerIds", markerIds);
  triggerMarkerRerender();
};

/**
 * Display quest navigation line on map.
 * @param {any} quest
 */
const displayQuestLine = (quest) => {
  if (!state.map) return;

  clearQuestLine();

  // Create quest pane
  if (!state.map.getPane("questPane")) {
    state.map.createPane("questPane");
    state.map.getPane("questPane").style.zIndex = "640";
    state.map.getPane("questPane").style.pointerEvents = "none";
  }

  // Collect coordinates
  const filteredSteps = quest.steps
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !currentFilter || s.group === currentFilter || s.group === "skill");

  const coords = [];
  filteredSteps.forEach(({ s }) => {
    if (s.coordinates) {
      coords.push([s.coordinates.lat, s.coordinates.lng]);
    }
  });

  if (coords.length < 2) return;

  // Draw polyline
  questPolyline = L.polyline(coords, {
    color: "#daac71",
    weight: 3,
    opacity: 0.8,
    pane: "questPane",
    className: "quest-polyline",
  }).addTo(state.map);

  // Add step badges
  const progress = state.questProgress || {};
  const completedSteps = progress[quest.id] || [];

  filteredSteps.forEach(({ s: step, i: index }, visibleIdx) => {
    if (!step.coordinates) return;

    const isCompleted = completedSteps.includes(step.id);
    const isActive = index === currentStepIndex;
    const label = currentFilter ? visibleIdx + 1 : step.order || index + 1;

    const badgeHtml = `<div class="quest-badge-marker ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""}">${label}</div>`;

    const icon = L.divIcon({
      html: badgeHtml,
      className: "quest-badge-container",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const marker = L.marker([step.coordinates.lat, step.coordinates.lng], {
      icon,
      pane: "questPane",
      zIndexOffset: isActive ? 1001 : 100,
      interactive: false,
    }).addTo(state.map);

    questBadgeMarkers.push(marker);
  });
};

/**
 * Clear quest line from map.
 */
const clearQuestLine = () => {
  if (questPolyline && state.map) {
    state.map.removeLayer(questPolyline);
    questPolyline = null;
  }

  questBadgeMarkers.forEach((m) => {
    if (state.map) state.map.removeLayer(m);
  });
  questBadgeMarkers = [];
};

/** @type {boolean} */
let isProgrammaticScroll = false;

/**
 * Navigate to a specific step.
 * @param {number} index
 */
export const navigateToStep = (index, fly = false, scroll = true) => {
  if (!currentQuestData) return;
  if (index < 0 || index >= currentQuestData.steps.length) return;

  currentStepIndex = index;
  updateStepHighlight(index);
  updateNavIndicator();

  if (currentQuestData) {
    displayQuestLine(currentQuestData);
  }

  const options = state.questDisplayOptions || { showMapCoords: true, showImages: true, showVideos: true };
  if (fly && options.showMapCoords !== false) {
    flyToStepLocation(currentQuestData.steps[index]);
  }

  if (scroll) {
    isProgrammaticScroll = true;
    const stepEl = document.querySelector(
      `.quest-step-card[data-step-index="${index}"]`,
    );
    if (stepEl) {
      stepEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Release flag after scroll animation
    setTimeout(() => { isProgrammaticScroll = false; }, 800);
  }
};

/**
 * Fly to a step's map location.
 * @param {any} step
 */
export const flyToStepLocation = (step) => {
  if (!step || !state.map) return;

  if (step.markerId) {
    import("../ui/navigation.js").then((nav) => {
      if (nav.jumpToId) {
        nav.jumpToId(step.markerId);
      }
    });
  } else if (step.coordinates) {
    const { lat, lng, zoom } = step.coordinates;
    if (lat != null && lng != null) {
      state.map.flyTo([lat, lng], zoom || 12, {
        animate: true,
        duration: 0.8,
      });
    }
  }
};

/**
 * Toggle step completion.
 * @param {string} questId
 * @param {string} stepId
 */
export const toggleStepComplete = async (questId, stepId) => {
  const progress = { ...(state.questProgress || {}) };
  const completed = progress[questId] || [];
  let isNowCompleted = false;

  if (completed.includes(stepId)) {
    progress[questId] = completed.filter((id) => id !== stepId);
    isNowCompleted = false;
  } else {
    progress[questId] = [...completed, stepId];
    isNowCompleted = true;
  }

  setState("questProgress", progress);

  // Sync with Map Marker completion
  const step = currentQuestData?.id === questId
    ? currentQuestData.steps.find((s) => s.id === stepId)
    : null;

  if (step && step.markerId) {
    const markerId = String(step.markerId);
    const isMarkerCompleted = state.completedList.some(m => String(m.id) === markerId);

    // Only toggle if status is different
    if (isNowCompleted !== isMarkerCompleted) {
      const { toggleCompleted } = await import("../ui/navigation.js");
      await toggleCompleted(markerId);
    }
  }

  try {
    await primaryDb.set("questProgress", progress);
  } catch (err) {
    console.error("Failed to save quest progress:", err);
  }

  if (currentQuestData && currentQuestData.id === questId) {
    const options = state.questDisplayOptions || {
      showImages: true,
      showVideos: true,
      showMapCoords: true,
    };
    renderQuestDetail(
      currentQuestData,
      progress[questId] || [],
      options,
      currentStepIndex,
      currentFilter,
    );
    lazyLoader.observeAll(".lazy-load", document.getElementById("quest-guide-content"));
    displayQuestLine(currentQuestData);
  }
};

/**
 * Update display options.
 * @param {"showImages"|"showVideos"|"showMapCoords"} option
 */
export const updateDisplayOption = (option) => {
  const options = { ...(state.questDisplayOptions || {}) };
  options[option] = !options[option];
  setState("questDisplayOptions", options);

  const content = document.getElementById("quest-guide-content");
  if (content) {
    content.classList.toggle(
      "quest-hide-images",
      !options.showImages,
    );
    content.classList.toggle(
      "quest-hide-videos",
      !options.showVideos,
    );
    content.classList.toggle(
      "quest-hide-coords",
      !options.showMapCoords,
    );
  }

  const btnMap = {
    showImages: "[data-action='quest-toggle-images']",
    showVideos: "[data-action='quest-toggle-videos']",
    showMapCoords: "[data-action='quest-toggle-coords']",
  };
  const btn = document.querySelector(btnMap[option]);
  if (btn) btn.classList.toggle("active", options[option]);
};

/**
 * Update nav indicator text.
 */
const updateNavIndicator = () => {
  const indicator = document.getElementById("quest-step-indicator");
  if (indicator && currentQuestData) {
    if (currentFilter) {
      const visibleSteps = currentQuestData.steps
        .map((s, i) => ({ s, i }))
        .filter(
          (item) => item.s.group === currentFilter || item.s.group === "skill",
        );
      const currentVisibleIdx = visibleSteps.findIndex(
        (item) => item.i === currentStepIndex,
      );
      if (currentVisibleIdx !== -1) {
        indicator.textContent = `${currentVisibleIdx + 1} / ${visibleSteps.length}`;
      } else {
        indicator.textContent = `- / ${visibleSteps.length}`;
      }
    } else {
      indicator.textContent = `${currentStepIndex + 1} / ${currentQuestData.steps.length}`;
    }
  }

  const prevBtn = document.querySelector(
    "[data-action='quest-step-prev']",
  );
  const nextBtn = document.querySelector(
    "[data-action='quest-step-next']",
  );
  if (prevBtn)
    /** @type {HTMLButtonElement} */ (prevBtn).disabled =
      currentStepIndex <= 0;
  if (nextBtn)
    /** @type {HTMLButtonElement} */ (nextBtn).disabled =
      !currentQuestData ||
      currentStepIndex >= currentQuestData.steps.length - 1;
};

/**
 * Trigger marker re-render to apply/remove glow.
 */
const triggerMarkerRerender = () => {
  import("../map/markers.js")
    .then((m) => {
      if (m.renderMapDataAndMarkers) {
        m.renderMapDataAndMarkers();
      }
    })
    .catch(() => { });
};

/**
 * Initialize quest guide event handling.
 */
export const initQuestGuideEvents = () => {
  if (/** @type {any} */ (window)._questGuideEventsInitialized) return;
  /** @type {any} */ (window)._questGuideEventsInitialized = true;

  document.addEventListener("click", (e) => {
    const el = /** @type {HTMLElement} */ (e.target);
    const target = /** @type {HTMLElement} */ (
      el.closest("[data-action]")
    );
    if (!target) return;

    const action = target.dataset.action;

    switch (action) {
      case "open-quest-list":
        e.stopPropagation();
        openQuestGuide();
        break;

      case "open-quest":
        e.stopPropagation();
        openQuestGuide(target.dataset.questId);
        break;

      case "close-quest-guide":
        e.stopPropagation();
        closeQuestGuide();
        break;

      case "quest-back":
        e.stopPropagation();
        clearQuestLine();
        setState("activeQuestMarkerIds", new Set());
        triggerMarkerRerender();
        showQuestList();
        break;

      case "quest-step-prev": {
        e.stopPropagation();
        if (!currentQuestData) break;
        let prevIdx = currentStepIndex - 1;
        while (prevIdx >= 0) {
          if (!currentFilter || currentQuestData.steps[prevIdx].group === currentFilter || currentQuestData.steps[prevIdx].group === "skill") {
            navigateToStep(prevIdx, true, true);
            break;
          }
          prevIdx--;
        }
        break;
      }

      case "quest-step-next": {
        e.stopPropagation();
        if (!currentQuestData) break;
        let nextIdx = currentStepIndex + 1;
        while (nextIdx < currentQuestData.steps.length) {
          if (!currentFilter || currentQuestData.steps[nextIdx].group === currentFilter || currentQuestData.steps[nextIdx].group === "skill") {
            navigateToStep(nextIdx, true, true);
            break;
          }
          nextIdx++;
        }
        break;
      }

      case "quest-step-complete": {
        e.stopPropagation();
        const qId = target.dataset.questId;
        const sId = target.dataset.stepId;
        if (qId && sId) toggleStepComplete(qId, sId);
        break;
      }

      case "quest-jump-to-map": {
        e.stopPropagation();
        const stepIndex = parseInt(target.dataset.stepIndex);
        if (
          !isNaN(stepIndex) &&
          currentQuestData &&
          currentQuestData.steps[stepIndex]
        ) {
          currentStepIndex = stepIndex;
          updateStepHighlight(stepIndex);
          updateNavIndicator();
          flyToStepLocation(currentQuestData.steps[stepIndex]);
        }
        break;
      }

      case "quest-step-click": {
        e.stopPropagation();
        const idx = parseInt(target.dataset.stepIndex);
        if (!isNaN(idx)) {
          navigateToStep(idx, false, false);
        }
        break;
      }

      case "quest-toggle-images":
        e.stopPropagation();
        updateDisplayOption("showImages");
        break;

      case "quest-toggle-videos":
        e.stopPropagation();
        updateDisplayOption("showVideos");
        break;

      case "quest-toggle-coords":
        e.stopPropagation();
        updateDisplayOption("showMapCoords");
        break;

      case "quest-open-linked": {
        e.stopPropagation();
        const linkedId = target.dataset.questId;
        if (linkedId) {
          clearQuestLine();
          showQuestDetail(linkedId);
        }
        break;
      }

      case "quest-filter": {
        e.stopPropagation();
        currentFilter = target.dataset.group || "";

        // If current step doesn't match filter, jump to first matching step
        if (currentFilter && currentQuestData) {
          const currentStep = currentQuestData.steps[currentStepIndex];
          if (currentStep && currentStep.group !== currentFilter && currentStep.group !== "skill") {
            const firstMatchIdx = currentQuestData.steps.findIndex(
              (s) => s.group === currentFilter || s.group === "skill",
            );
            if (firstMatchIdx !== -1) {
              currentStepIndex = firstMatchIdx;
              flyToStepLocation(currentQuestData.steps[firstMatchIdx]);
            }
          }
        }

        const progress = state.questProgress || {};
        const options = state.questDisplayOptions || {
          showImages: true,
          showVideos: true,
          showMapCoords: true,
        };
        renderQuestDetail(
          currentQuestData,
          progress[currentQuestData.id] || [],
          options,
          currentStepIndex,
          currentFilter,
        );
        lazyLoader.observeAll(".lazy-load", document.getElementById("quest-guide-content"));
        updateQuestMarkers(currentQuestData);
        displayQuestLine(currentQuestData);
        updateNavIndicator();
        break;
      }
      case "view-image":
        e.stopPropagation();
        const imgTarget = /** @type {HTMLImageElement} */ (target);
        resetGif(imgTarget);
        import("../ui.js").then((ui) => {
          const src = imgTarget.src || imgTarget.getAttribute("src");
          if (ui.openLightbox && src) {
            ui.openLightbox(src);
          }
        });
        break;

      case "quest-share-link":
        e.stopPropagation();
        const shareUrl = target.dataset.url;
        if (shareUrl) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            alert("링크가 복사되었습니다!");
          });
        }
        break;

      case "quest-share-link-list":
        e.stopPropagation();
        const qId = target.dataset.questId;
        if (qId) {
          const url = `${window.location.origin}${window.location.pathname}?quest=${qId}`;
          navigator.clipboard.writeText(url).then(() => {
            alert("링크가 복사되었습니다!");
          });
        }
        break;
    }
  });

  // Init scroll spy immediately if content exists
  initScrollSpy();
};

/** @type {IntersectionObserver|null} */
let stepObserver = null;

/**
 * Initialize Scroll Spy for quest steps.
 */
const initScrollSpy = () => {
  if (stepObserver) stepObserver.disconnect();

  const container = document.getElementById("quest-guide-content");
  if (!container) return; // Not ready yet

  // Use a map to track visibility ratio of each step
  const visibilityMap = new Map();

  stepObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const target = /** @type {HTMLElement} */ (entry.target);
        const index = parseInt(target.dataset.stepIndex);

        if (!isNaN(index)) {
          visibilityMap.set(index, entry.intersectionRatio);
        }
      });

      // Find the step with the highest visibility ratio
      let maxRatio = 0;
      let maxIndex = -1;

      for (const [index, ratio] of visibilityMap.entries()) {
        if (ratio > maxRatio) {
          maxRatio = ratio;
          maxIndex = index;
        }
      }

      // If a step is dominantly visible (e.g. > 30% or just the max one), activate it
      // But we only want to trigger if it's different from current
      if (!isProgrammaticScroll && maxIndex !== -1 && maxIndex !== currentStepIndex && maxRatio > 0.3) {
        // Pass scroll=false to avoid jumping back
        navigateToStep(maxIndex, true, false);
      }
    },
    {
      root: container,
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      rootMargin: "-10% 0px -10% 0px" // Slight buffer to focus on center
    },
  );

  document.querySelectorAll(".quest-step-card").forEach((el) => {
    stepObserver.observe(el);
  });
};
