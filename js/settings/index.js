import { state, setState } from '../state.js';
import { initAuth } from '../auth.js';
import { triggerSync } from '../sync.js';

import { AI_MODELS, updateModelOptions, updateApiKeyInput, saveAISettings, initAISettings } from './ai.js';
import { initAdToggle, initToggles, saveToggleSettings, updateClusteringToggleState } from './toggles.js';
import { applyMenuPosition, initAppearanceSettings, saveAppearanceSettings } from './appearance.js';
import { initCloudBackupSection, loadCloudBackups } from './backup.js';

export const saveSettings = (settingsModal) => {
    try {
        saveAISettings();
        saveAppearanceSettings();
        saveToggleSettings();

        triggerSync();

        alert("설정이 저장되었습니다. 적용을 위해 페이지를 새로고침합니다.");
        if (settingsModal) settingsModal.classList.add('hidden');
        location.reload();
    } catch (error) {
        console.error("저장 중 에러 발생:", error);
        alert("설정 저장 중 오류가 발생했습니다.");
    }
};

export const initSettingsModal = () => {
    initAuth();

    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings');
    const saveApiKeyBtn = document.getElementById('save-api-key');

    const aiSettings = initAISettings();
    const toggles = initToggles();
    const appearance = initAppearanceSettings();

    let initialState = toggles.getInitialState();

    if (openSettingsBtn && settingsModal) {
        openSettingsBtn.addEventListener('click', () => {
            initialState = toggles.getInitialState();

            aiSettings.loadValues();
            toggles.loadValues();
            appearance.loadValues();

            settingsModal.classList.remove('hidden');
        });

        const closeSettingsBtn = document.getElementById('close-settings');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                if (state.enableClustering !== initialState.clustering ||
                    state.savedGpuSetting !== initialState.gpuSetting) {
                    alert("렌더링 설정이 변경되었습니다. 적용을 위해 페이지를 새로고침합니다.");
                    location.reload();
                } else {
                    settingsModal.classList.add('hidden');
                }
            });
        }
    }

    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', (event) => {
            event.preventDefault();
            saveSettings(settingsModal);
        });
    }

    initCloudBackupSection();
};

export {
    AI_MODELS,
    updateModelOptions,
    updateApiKeyInput,
    initAdToggle,
    applyMenuPosition,
    loadCloudBackups
};
