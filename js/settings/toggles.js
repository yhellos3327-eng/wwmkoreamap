// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { triggerSync, updateSettingWithTimestamp } from "../sync.js";
import { renderMapDataAndMarkers } from "../map.js";

/**
 * 광고 토글을 초기화합니다.
 */
export const initAdToggle = async () => {
  const adContainer = /** @type {HTMLElement} */ (
    document.querySelector(".ad-container")
  );
  const toggleAd = /** @type {HTMLInputElement} */ (
    document.getElementById("toggle-ad")
  );

  if (!adContainer || !toggleAd) return;

  const { primaryDb } = await import("../storage/db.js");
  const storedAd = await primaryDb.get("wwm_show_ad");

  // 불리언 및 문자열 저장 값 모두 처리
  let showAd = true; // 기본값
  if (storedAd !== null) {
    if (typeof storedAd === "boolean") {
      showAd = storedAd;
    } else {
      showAd = storedAd.toString().toLowerCase() === "true";
    }
  }

  toggleAd.checked = showAd;
  adContainer.style.display = showAd ? "block" : "none";

  toggleAd.addEventListener("change", async (e) => {
    const isChecked = /** @type {HTMLInputElement} */ (e.target).checked;
    try {
      const result = await primaryDb.set("wwm_show_ad", String(isChecked));
      if (result && result.success) {
        adContainer.style.display = isChecked ? "block" : "none";
        triggerSync();
      } else {
        // 저장 실패 시 복구
        toggleAd.checked = !isChecked;
        console.warn("광고 토글 저장 실패:", result?.error);
      }
    } catch (err) {
      toggleAd.checked = !isChecked;
      console.warn("광고 토글 저장 실패:", err);
    }
  });
};

/**
 * 저사양 모드를 적용합니다.
 * @param {boolean} isLowSpec - 저사양 모드 활성화 여부.
 */
export const applyLowSpecMode = (isLowSpec) => {
  document.body.classList.remove("low-spec-mode");
};

/**
 * 클러스터링 토글 상태를 업데이트합니다.
 */
export const updateClusteringToggleState = () => {
  const clusterToggleInput = document.getElementById("toggle-cluster");
  if (!clusterToggleInput) return;

  /** @type {HTMLInputElement} */ (clusterToggleInput).disabled = false;
  const wrapper = /** @type {HTMLElement} */ (
    clusterToggleInput.closest(".settings-toggle-wrapper")
  );
  if (wrapper) {
    wrapper.style.opacity = "1";
    wrapper.style.cursor = "default";
    wrapper.title = "";
    const slider = /** @type {HTMLElement} */ (
      wrapper.querySelector(".slider")
    );
    if (slider) slider.style.cursor = "pointer";
    const switchLabel = /** @type {HTMLElement} */ (
      wrapper.querySelector(".switch")
    );
    if (switchLabel) switchLabel.style.pointerEvents = "auto";
  }
};

/**
 * 각종 설정 토글을 초기화합니다.
 * @returns {{loadValues: Function, getInitialState: Function}}
 */
export const initToggles = () => {
  const clusterToggleInput = document.getElementById("toggle-cluster");
  const hideCompletedInput = document.getElementById("toggle-hide-completed");
  const commentsToggleInput = document.getElementById("toggle-comments");
  const closeOnCompleteInput = document.getElementById(
    "toggle-close-on-complete",
  );
  const disableRegionPanInput = document.getElementById(
    "toggle-disable-region-pan",
  );
  const adToggleInput = document.getElementById("toggle-ad");
  const webLLMToggleInput = document.getElementById("toggle-web-llm");

  const chromeTranslatorStatus = document.getElementById(
    "chrome-translator-status",
  );

  if (chromeTranslatorStatus) {
    chromeTranslatorStatus.style.display = "block";

    const updateChromeStatusUI = (status) => {
      const badge = document.getElementById("chrome-badge");
      const translatorStatusEl = document.getElementById("translator-status");
      const detectorStatusEl = document.getElementById("detector-status");

      const getStatusText = (s) => {
        switch (s) {
          case "available":
            return "준비됨";
          case "downloadable":
            return "다운로드 필요";
          case "downloading":
            return "다운로드 중...";
          case "unavailable":
            return "사용 불가";
          default:
            return s || "알 수 없음";
        }
      };

      const getStatusClass = (s) => {
        if (s === "available") return "available";
        if (s === "downloadable" || s === "downloading") return "downloadable";
        return "unavailable";
      };

      if (!status.supported) {
        if (badge) {
          badge.className = "chrome-badge unavailable";
          badge.querySelector("span").textContent = "미지원";
        }
        if (translatorStatusEl) {
          translatorStatusEl.textContent = "미지원";
          translatorStatusEl.className = "chrome-status-value unavailable";
        }
        if (detectorStatusEl) {
          detectorStatusEl.textContent = "미지원";
          detectorStatusEl.className = "chrome-status-value unavailable";
        }
      } else {
        let overallStatus = "available";
        if (
          status.translatorStatus !== "available" ||
          status.detectorStatus !== "available"
        ) {
          overallStatus =
            status.translatorStatus === "downloadable" ||
              status.detectorStatus === "downloadable"
              ? "downloadable"
              : "unavailable";
        }

        const badgeTexts = {
          available: "사용 가능",
          downloadable: "다운로드 필요",
          unavailable: "사용 불가",
        };

        if (badge) {
          badge.className = `chrome-badge ${overallStatus}`;
          badge.querySelector("span").textContent = badgeTexts[overallStatus];
        }

        if (translatorStatusEl) {
          translatorStatusEl.textContent = getStatusText(
            status.translatorStatus,
          );
          translatorStatusEl.className = `chrome-status-value ${getStatusClass(status.translatorStatus)}`;
        }
        if (detectorStatusEl) {
          detectorStatusEl.textContent = getStatusText(status.detectorStatus);
          detectorStatusEl.className = `chrome-status-value ${getStatusClass(status.detectorStatus)}`;
        }
      }
    };

    // Chrome 번역 상태 확인 지연 실행
    setTimeout(async () => {
      try {
        const { checkStatus } = await import("../chromeTranslator.js");
        const status = await checkStatus();
        updateChromeStatusUI(status);
      } catch (err) {
        console.error("Chrome 번역 상태 확인 실패:", err);
        const badge = document.getElementById("chrome-badge");
        if (badge) {
          badge.className = "chrome-badge unavailable";
          badge.querySelector("span").textContent = "확인 실패";
        }
      }
    }, 100);
  }

  if (webLLMToggleInput) {
    /** @type {HTMLInputElement} */ (webLLMToggleInput).checked =
      state.enableWebLLM;
    webLLMToggleInput.addEventListener("change", (e) => {
      setState(
        "enableWebLLM",
        /** @type {HTMLInputElement} */(e.target).checked,
      );
      updateSettingWithTimestamp(
        "enableWebLLM",
        /** @type {HTMLInputElement} */(e.target).checked,
      ).catch((err) => console.warn("웹 LLM 설정 업데이트 실패:", err));
    });
  }

  if (clusterToggleInput) {
    /** @type {HTMLInputElement} */ (clusterToggleInput).checked =
      state.enableClustering;
    clusterToggleInput.addEventListener("change", (e) => {
      setState(
        "enableClustering",
        /** @type {HTMLInputElement} */(e.target).checked,
      );
      updateSettingWithTimestamp(
        "enableClustering",
        /** @type {HTMLInputElement} */(e.target).checked,
      ).catch((err) => console.warn("클러스터링 설정 업데이트 실패:", err));
      renderMapDataAndMarkers();
    });
  }

  if (hideCompletedInput) {
    /** @type {HTMLInputElement} */ (hideCompletedInput).checked =
      state.hideCompleted;
    hideCompletedInput.addEventListener("change", (e) => {
      setState(
        "hideCompleted",
        /** @type {HTMLInputElement} */(e.target).checked,
      );
      updateSettingWithTimestamp(
        "hideCompleted",
        /** @type {HTMLInputElement} */(e.target).checked,
      ).catch((err) => console.warn("완료 숨기기 설정 업데이트 실패:", err));
      renderMapDataAndMarkers();
    });
  }

  if (commentsToggleInput) {
    /** @type {HTMLInputElement} */ (commentsToggleInput).checked =
      state.showComments;
    commentsToggleInput.addEventListener("change", (e) => {
      setState(
        "showComments",
        /** @type {HTMLInputElement} */(e.target).checked,
      );
      updateSettingWithTimestamp(
        "showComments",
        /** @type {HTMLInputElement} */(e.target).checked,
      ).catch((err) => console.warn("댓글 표시 설정 업데이트 실패:", err));
    });
  }

  if (closeOnCompleteInput) {
    /** @type {HTMLInputElement} */ (closeOnCompleteInput).checked =
      state.closeOnComplete;
    closeOnCompleteInput.addEventListener("change", (e) => {
      setState(
        "closeOnComplete",
        /** @type {HTMLInputElement} */(e.target).checked,
      );
      updateSettingWithTimestamp(
        "closeOnComplete",
        /** @type {HTMLInputElement} */(e.target).checked,
      ).catch((err) => console.warn("완료 시 닫기 설정 업데이트 실패:", err));
    });
  }

  if (disableRegionPanInput) {
    /** @type {HTMLInputElement} */ (disableRegionPanInput).checked =
      state.disableRegionClickPan;
    disableRegionPanInput.addEventListener("change", (e) => {
      setState(
        "disableRegionClickPan",
        /** @type {HTMLInputElement} */(e.target).checked,
      );
      updateSettingWithTimestamp(
        "disableRegionClickPan",
        /** @type {HTMLInputElement} */(e.target).checked,
      ).catch((err) => console.warn("지역 클릭 이동 비활성화 설정 업데이트 실패:", err));
    });
  }

  return {
    loadValues: async () => {
      if (adToggleInput) {
        const { primaryDb } = await import("../storage/db.js");
        const storedAd = await primaryDb.get("wwm_show_ad");

        let showAd = true;
        if (storedAd !== null) {
          if (typeof storedAd === "boolean") {
            showAd = storedAd;
          } else {
            showAd = storedAd.toString().toLowerCase() === "true";
          }
        }
        /** @type {HTMLInputElement} */ (adToggleInput).checked = showAd;

        const adContainer = document.querySelector(".ad-container");
        if (adContainer) {
          /** @type {HTMLElement} */(adContainer).style.display = showAd ? "block" : "none";
        }
      }
      if (clusterToggleInput)
        /** @type {HTMLInputElement} */ (clusterToggleInput).checked =
          state.enableClustering;
      if (hideCompletedInput)
        /** @type {HTMLInputElement} */ (hideCompletedInput).checked =
          state.hideCompleted;
      if (disableRegionPanInput)
        /** @type {HTMLInputElement} */ (disableRegionPanInput).checked =
          state.disableRegionClickPan;
      if (webLLMToggleInput)
        /** @type {HTMLInputElement} */ (webLLMToggleInput).checked =
          state.enableWebLLM;

      updateClusteringToggleState();
    },
    getInitialState: () => ({
      clustering: state.enableClustering,
      useChromeTranslator: state.useChromeTranslator,
      webLLM: state.enableWebLLM,
    }),
  };
};

/**
 * 토글 설정을 저장합니다.
 */
export const saveToggleSettings = async () => {
  const adToggleInput = document.getElementById("toggle-ad");

  if (adToggleInput) {
    try {
      const { primaryDb } = await import("../storage/db.js");
      const isChecked = /** @type {HTMLInputElement} */(adToggleInput).checked;
      const result = await primaryDb.set("wwm_show_ad", String(isChecked));
      if (result && result.success) {
        console.log("광고 토글 설정 저장 성공");
      } else {
        console.warn("광고 토글 설정 저장 실패:", result?.error);
      }
    } catch (err) {
      console.warn("광고 토글 설정 저장 중 에러:", err);
    }
  }
};
