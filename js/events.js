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
};

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

export const initRelatedModal = () => {
  const relatedModal = document.getElementById("related-modal");
  if (relatedModal) {
    relatedModal.addEventListener("click", (e) => {
      if (e.target.id === "related-modal") closeModal();
    });
  }
};

export const initWebLLMModal = () => {
  const webLLMModal = document.getElementById("web-llm-modal");
  const openWebLLMModalBtn = document.getElementById("open-web-llm-modal");

  if (openWebLLMModalBtn && webLLMModal) {
    openWebLLMModalBtn.addEventListener("click", () => {
      import("./web-llm.js").then((m) => m.openWebLLMModal());
    });
  }
};

export const initKeyboardEvents = () => {
  document.addEventListener("keydown", (e) => {
    const lightbox = document.getElementById("lightbox-modal");
    if (!lightbox.classList.contains("hidden")) {
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

export const initGlobalEventDelegation = () => {
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
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

export const initRouteMode = () => {
  const routeToggleBtn = document.getElementById("route-mode-toggle");

  if (routeToggleBtn) {
    routeToggleBtn.addEventListener("click", async () => {
      try {
        const routeModule = await import("./route/index.js");
        const isActive = routeModule.toggleRouteMode();
        routeToggleBtn.classList.toggle("active", isActive);
        // 사이드바 경로 버튼도 동기화
        const sidebarRouteBtn = document.getElementById("sidebar-route-toggle");
        if (sidebarRouteBtn)
          sidebarRouteBtn.classList.toggle("active", isActive);
      } catch (error) {
        console.error("Failed to load route module:", error);
      }
    });
  }
};

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

export const initReportPanel = () => {
  const closeBtn = document.getElementById("close-report-panel");
  const panel = document.getElementById("report-panel");
  const embed = document.getElementById("report-embed");

  if (closeBtn && panel) {
    closeBtn.addEventListener("click", () => {
      panel.classList.remove("open");
      if (embed) {
        embed.setAttribute("data", "");
      }
    });
  }
};

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
  initReportPanel();
};
