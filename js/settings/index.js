// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { initAuth } from "../auth.js";
import { triggerSync } from "../sync.js";

import {
  AI_MODELS,
  updateModelOptions,
  updateApiKeyInput,
  saveAISettings,
  initAISettings,
} from "./ai.js";
import {
  initAdToggle,
  initToggles,
  saveToggleSettings,
  updateClusteringToggleState,
} from "./toggles.js";
import {
  applyMenuPosition,
  initAppearanceSettings,
  saveAppearanceSettings,
} from "./appearance.js";
import { initCloudBackupSection, loadCloudBackups } from "./backup.js";
import { initShortcuts } from "./shortcuts.js";

/**
 * 설정을 저장합니다.
 * @param {HTMLElement} settingsModal - 설정 모달 엘리먼트.
 */
export const saveSettings = async (settingsModal) => {
  try {
    await saveAISettings();
    await saveAppearanceSettings();
    await saveToggleSettings();

    triggerSync();

    alert("설정이 저장되었습니다. 적용을 위해 페이지를 새로고침합니다.");
    if (settingsModal) settingsModal.classList.add("hidden");
    location.reload();
  } catch (error) {
    console.error("저장 중 에러 발생:", error);
    alert("설정 저장 중 오류가 발생했습니다.");
  }
};

/**
 * 설정 모달을 초기화합니다.
 */
export const initSettingsModal = async () => {
  initAuth();

  const settingsModal = document.getElementById("settings-modal");
  const openSettingsBtn = document.getElementById("open-settings");
  const saveApiKeyBtn = document.getElementById("save-api-key");

  const aiSettings = initAISettings();
  const toggles = initToggles();
  const appearance = initAppearanceSettings();

  let initialState = toggles.getInitialState();

  if (openSettingsBtn && settingsModal) {
    openSettingsBtn.addEventListener("click", async () => {
      initialState = toggles.getInitialState();

      await aiSettings.loadValues();
      await toggles.loadValues();
      await appearance.loadValues();

      settingsModal.classList.remove("hidden");
    });

    const closeSettingsBtn = document.getElementById("close-settings");
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener("click", () => {
        if (
          state.enableClustering !== initialState.clustering ||
          state.enableWebLLM !== initialState.webLLM
        ) {
          alert("설정이 변경되었습니다. 적용을 위해 페이지를 새로고침합니다.");
          location.reload();
        } else {
          settingsModal.classList.add("hidden");
        }
      });
    }
  }

  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener("click", (event) => {
      event.preventDefault();
      saveSettings(settingsModal);
    });
  }

  initCloudBackupSection();
  await initShortcuts();
};

export {
  AI_MODELS,
  updateModelOptions,
  updateApiKeyInput,
  initAdToggle,
  applyMenuPosition,
  loadCloudBackups,
};
