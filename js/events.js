// @ts-check
import { state } from "./state.js";
import {
  toggleSidebar,
  setAllCategories,
  setAllRegions,
  closeModal,
  closeLightbox,
  switchLightbox,
  renderContributionModal,
} from "./ui.js";
import { toggleCommunityMode } from "./map/community.js";

/**
 * 탭 이벤트 리스너를 초기화합니다.
 */
export const initTabs = () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const targetId = tab.getAttribute("data-tab");
      tabContents.forEach((c) => {
        c.classList.remove("active");
        if (c.id === targetId) {
          c.classList.add("active");
          if (targetId === "favorite-tab") {
            import("./ui.js").then((ui) => ui.renderFavorites());
          }
        }
      });
    });
  });
};

/**
 * 카테고리 및 지역 토글 버튼을 초기화합니다.
 */
export const initToggleButtons = () => {
  const btnToggleCat = document.getElementById("btn-toggle-cat");
  const btnToggleReg = document.getElementById("btn-toggle-reg");

  if (btnToggleCat) {
    btnToggleCat.addEventListener("click", () => {
      const validCats = state.mapData.categories;
      const allActive = state.activeCategoryIds.size === validCats.length;
      setAllCategories(!allActive);
    });
  }

  if (btnToggleReg) {
    btnToggleReg.addEventListener("click", () => {
      const allActive =
        state.activeRegionNames.size === state.uniqueRegions.size;
      setAllRegions(!allActive);
    });
  }

  const btnCompleteCat = document.getElementById("btn-complete-cat");
  const btnResetCat = document.getElementById("btn-reset-cat");
  const btnCompleteReg = document.getElementById("btn-complete-reg");
  const btnResetReg = document.getElementById("btn-reset-reg");

  if (btnCompleteCat) {
    btnCompleteCat.addEventListener("click", () => {
      import("./ui/sidebar/categories.js").then((m) =>
        m.completeAllActiveCategories(),
      );
    });
  }
  if (btnResetCat) {
    btnResetCat.addEventListener("click", () => {
      import("./ui/sidebar/categories.js").then((m) =>
        m.resetAllActiveCategories(),
      );
    });
  }
  if (btnCompleteReg) {
    btnCompleteReg.addEventListener("click", () => {
      import("./ui/sidebar/regions.js").then((m) =>
        m.completeAllActiveRegions(),
      );
    });
  }
  if (btnResetReg) {
    btnResetReg.addEventListener("click", () => {
      import("./ui/sidebar/regions.js").then((m) => m.resetAllActiveRegions());
    });
  }
};

/**
 * 사이드바 토글 이벤트를 초기화합니다.
 */
export const initSidebarToggle = () => {
  const openBtn = document.getElementById("open-sidebar");
  const closeBtn = document.getElementById("toggle-sidebar");
  const floatingOpenBtn = document.getElementById("floating-sidebar-toggle");

  if (openBtn) {
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebar("open");
    });
  }

  if (floatingOpenBtn) {
    floatingOpenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebar("open");
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => toggleSidebar("close"));
  }

  window.addEventListener("resize", () => {
    if (state.map) state.map.invalidateSize();
  });
};

/**
 * 관련 항목 모달을 초기화합니다.
 */
export const initRelatedModal = () => {
  const relatedModal = document.getElementById("related-modal");
  if (relatedModal) {
    relatedModal.addEventListener("click", (e) => {
      const el = /** @type {HTMLElement} */ (e.target);
      if (el.id === "related-modal") closeModal();
    });
  }
};

/**
 * WebLLM 모달 이벤트를 초기화합니다.
 */
export const initWebLLMModal = () => {
  const webLLMModal = document.getElementById("web-llm-modal");
  const openWebLLMModalBtn = document.getElementById("open-web-llm-modal");

  if (openWebLLMModalBtn) {
    if (!state.enableWebLLM) {
      openWebLLMModalBtn.style.display = "none";
    } else {
      openWebLLMModalBtn.style.display = "flex";
      if (webLLMModal) {
        openWebLLMModalBtn.addEventListener("click", () => {
          import("./web-llm.js").then((m) => m.openWebLLMModal());
        });
      }
    }
  }
};

/**
 * 키보드 단축키를 초기화합니다.
 */
export const initKeyboardEvents = () => {
  document.addEventListener("keydown", (e) => {
    const lightbox = document.getElementById("lightbox-modal");
    if (lightbox && !lightbox.classList.contains("hidden")) {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        switchLightbox(-1);
      } else if (e.key === "ArrowRight") {
        switchLightbox(1);
      }
    }
  });
};

/**
 * 클릭에 대한 전역 이벤트 위임을 초기화합니다.
 */
export const initGlobalEventDelegation = () => {
  document.addEventListener("click", (e) => {
    const el = /** @type {HTMLElement} */ (e.target);
    const target = /** @type {HTMLElement} */ (el.closest("[data-action]"));
    if (!target) return;

    const action = target.dataset.action;

    switch (action) {
      case "close-web-llm-modal":
        e.stopPropagation();
        document.getElementById("web-llm-modal")?.classList.add("hidden");
        break;
      case "close-related-modal":
        e.stopPropagation();
        closeModal();
        break;
      case "close-dev-modal":
        e.stopPropagation();
        document.getElementById("dev-modal")?.classList.add("hidden");
        break;
      case "close-lightbox":
        closeLightbox();
        break;
      case "switch-lightbox":
        e.stopPropagation();
        switchLightbox(parseInt(target.dataset.dir));
        break;
      case "close-video-lightbox":
        import("./ui.js").then((ui) => ui.closeVideoLightbox());
        break;
      case "stop-propagation":
        e.stopPropagation();
        break;
    }
  });
};

/**
 * 경로 모드 이벤트를 초기화합니다.
 */
export const initRouteMode = () => {
  const routeToggleBtn = document.getElementById("route-mode-toggle");

  if (routeToggleBtn) {
    routeToggleBtn.addEventListener("click", async () => {
      try {
        const routeModule = await import("./route/index.js");
        const isActive = routeModule.toggleRouteMode();
        routeToggleBtn.classList.toggle("active", isActive);

        const sidebarRouteBtn = document.getElementById("sidebar-route-toggle");
        if (sidebarRouteBtn)
          sidebarRouteBtn.classList.toggle("active", isActive);
      } catch (error) {
        console.error("Failed to load route module:", error);
      }
    });
  }
};

/**
 * 아카 채널 패널 이벤트를 초기화합니다.
 */
export const initArcaChannel = () => {
  const openBtn = document.getElementById("open-arca-channel");
  const closeBtn = document.getElementById("close-arca-panel");
  const panel = document.getElementById("arca-panel");

  if (openBtn && panel) {
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      panel.classList.toggle("open");
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener("click", () => {
      panel.classList.remove("open");
    });
  }
};

/**
 * 커뮤니티 모드 토글을 초기화합니다.
 */
export const initCommunityMode = () => {
  const btn = document.getElementById("community-mode-toggle");
  const btnTop = document.getElementById("community-mode-toggle-top");

  if (btn) btn.addEventListener("click", toggleCommunityMode);
  if (btnTop) btnTop.addEventListener("click", toggleCommunityMode);
};

/**
 * 퀘스트 가이드 패널 이벤트를 초기화합니다.
 */
export const initQuestGuide = () => {
  const openBtn = document.getElementById("open-quest-guide");
  if (openBtn) {
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      import("./quest-guide/index.js").then((m) => m.openQuestGuide());
    });
  }

  import("./quest-guide/index.js").then((m) => {
    if (m.initQuestGuideEvents) m.initQuestGuideEvents();
  });
};

/**
 * 모든 이벤트 핸들러를 초기화합니다.
 */
export const initAllEventHandlers = () => {
  initTabs();
  initToggleButtons();
  initSidebarToggle();
  initRelatedModal();
  initWebLLMModal();
  initKeyboardEvents();
  initGlobalEventDelegation();
  initRouteMode();
  initArcaChannel();
  initCommunityMode();
  initQuestGuide();
};
