import { state, setState } from './state.js';
import { renderMapDataAndMarkers } from './map.js';
import { initAuth, updateAuthUI } from './auth.js';
import { triggerSync } from './sync.js';

export const AI_MODELS = {
    gemini: [
        { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2 Pro' },
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
        { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    ],
    openai: [
        { value: 'gpt-5.2-pro', label: 'GPT-5.2 pro' },
        { value: 'gpt-5.2', label: 'GPT 5.2' },
        { value: 'gpt-5', label: 'GPT-5' },
        { value: 'gpt-5-mini', label: 'GPT-5 mini' },
        { value: 'gpt-5-nano', label: 'GPT-5 nano' }
    ],
    claude: [
        { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
        { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
        { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ]
};

export const initAdToggle = () => {
    const adContainer = document.querySelector('.ad-container');
    const toggleAd = document.getElementById('toggle-ad');

    if (!adContainer || !toggleAd) return;

    const storedAd = localStorage.getItem('wwm_show_ad');
    const showAd = storedAd === null ? false : storedAd === 'true';
    toggleAd.checked = showAd;
    adContainer.style.display = showAd ? 'block' : 'none';

    toggleAd.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        localStorage.setItem('wwm_show_ad', isChecked);
        adContainer.style.display = isChecked ? 'block' : 'none';
        triggerSync();
    });
};

export const updateModelOptions = (provider) => {
    const apiModelSelect = document.getElementById('api-model-select');
    if (!apiModelSelect) return;

    apiModelSelect.innerHTML = '';
    const models = AI_MODELS[provider] || [];
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.label;
        apiModelSelect.appendChild(option);
    });
};

export const updateApiKeyInput = (provider) => {
    const apiKeyInput = document.getElementById('api-key-input');
    if (!apiKeyInput) return;

    let key = '';
    let placeholder = '';
    if (provider === 'gemini') {
        key = state.savedGeminiKey || state.savedApiKey;
        placeholder = "Google Gemini API Key 입력";
    } else if (provider === 'openai') {
        key = state.savedOpenAIKey;
        placeholder = "OpenAI API Key 입력 (sk-...)";
    } else if (provider === 'claude') {
        key = state.savedClaudeKey;
        placeholder = "Anthropic API Key 입력 (sk-ant-...)";
    }
    apiKeyInput.value = key || '';
    apiKeyInput.placeholder = placeholder;
};

export const saveSettings = (settingsModal) => {
    const apiProviderSelect = document.getElementById('api-provider-select');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiModelSelect = document.getElementById('api-model-select');
    const regionColorInput = document.getElementById('region-line-color');
    const regionFillColorInput = document.getElementById('region-fill-color');
    const adToggleInput = document.getElementById('toggle-ad');

    try {
        if (apiProviderSelect) {
            const provider = apiProviderSelect.value;
            setState('savedAIProvider', provider);
            localStorage.setItem('wwm_ai_provider', provider);

            if (apiKeyInput) {
                const newKey = apiKeyInput.value.trim();
                if (provider === 'gemini') {
                    setState('savedGeminiKey', newKey);
                    setState('savedApiKey', newKey);
                    localStorage.setItem('wwm_api_key', newKey);
                } else if (provider === 'openai') {
                    setState('savedOpenAIKey', newKey);
                    localStorage.setItem('wwm_openai_key', newKey);
                } else if (provider === 'claude') {
                    setState('savedClaudeKey', newKey);
                    localStorage.setItem('wwm_claude_key', newKey);
                }
            }
        } else if (apiKeyInput) {
            const newKey = apiKeyInput.value.trim();
            setState('savedApiKey', newKey);
            localStorage.setItem('wwm_api_key', newKey);
        }

        if (apiModelSelect) {
            const newModel = apiModelSelect.value;
            setState('savedApiModel', newModel);
            localStorage.setItem('wwm_api_model', newModel);
        }
        if (regionColorInput) {
            const newColor = regionColorInput.value;
            setState('savedRegionColor', newColor);
            localStorage.setItem('wwm_region_color', newColor);
        }
        if (regionFillColorInput) {
            const newFillColor = regionFillColorInput.value;
            setState('savedRegionFillColor', newFillColor);
            localStorage.setItem('wwm_region_fill_color', newFillColor);
        }
        if (adToggleInput) {
            localStorage.setItem('wwm_show_ad', adToggleInput.checked);
        }

        // Trigger cloud sync (except API keys which are local-only)
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
    // 인증 모듈 초기화
    initAuth();

    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings');
    const saveApiKeyBtn = document.getElementById('save-api-key');
    const apiProviderSelect = document.getElementById('api-provider-select');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiModelSelect = document.getElementById('api-model-select');
    const regionColorInput = document.getElementById('region-line-color');
    const regionFillColorInput = document.getElementById('region-fill-color');
    const adToggleInput = document.getElementById('toggle-ad');
    const clusterToggleInput = document.getElementById('toggle-cluster');
    const hideCompletedInput = document.getElementById('toggle-hide-completed');
    const commentsToggleInput = document.getElementById('toggle-comments');
    const closeOnCompleteInput = document.getElementById('toggle-close-on-complete');
    const gpuModeToggleInput = document.getElementById('toggle-gpu-mode');

    let initialClusteringState = state.enableClustering;
    let initialGpuModeState = state.gpuRenderMode;

    const updateClusteringToggleState = () => {
        if (!clusterToggleInput) return;

        if (state.gpuRenderMode) {
            clusterToggleInput.disabled = true;
            const wrapper = clusterToggleInput.closest('.settings-toggle-wrapper');
            if (wrapper) {
                wrapper.style.opacity = '0.5';
                wrapper.style.cursor = 'not-allowed';
                wrapper.title = "현재 GPU 모드에서는 클러스터링 설정을 변경할 수 없습니다.\n구현 예정입니다. 🙇‍♂️";

                const slider = wrapper.querySelector('.slider');
                if (slider) slider.style.cursor = 'not-allowed';
                const switchLabel = wrapper.querySelector('.switch');
                if (switchLabel) switchLabel.style.pointerEvents = 'none';
            }
        } else {
            clusterToggleInput.disabled = false;
            const wrapper = clusterToggleInput.closest('.settings-toggle-wrapper');
            if (wrapper) {
                wrapper.style.opacity = '1';
                wrapper.style.cursor = 'default';
                wrapper.title = "";
                const slider = wrapper.querySelector('.slider');
                if (slider) slider.style.cursor = 'pointer';
                const switchLabel = wrapper.querySelector('.switch');
                if (switchLabel) switchLabel.style.pointerEvents = 'auto';
            }
        }
    };

    if (apiProviderSelect) {
        apiProviderSelect.addEventListener('change', (e) => {
            const provider = e.target.value;
            updateModelOptions(provider);
            updateApiKeyInput(provider);
        });
    }

    if (openSettingsBtn && settingsModal) {
        openSettingsBtn.addEventListener('click', () => {
            initialClusteringState = state.enableClustering;

            if (apiProviderSelect) {
                apiProviderSelect.value = state.savedAIProvider;
                updateModelOptions(state.savedAIProvider);
                updateApiKeyInput(state.savedAIProvider);
            }

            if (apiModelSelect) apiModelSelect.value = state.savedApiModel;
            if (apiKeyInput && !apiProviderSelect) apiKeyInput.value = state.savedApiKey;
            if (adToggleInput) {
                const storedAd = localStorage.getItem('wwm_show_ad');
                adToggleInput.checked = storedAd === null ? true : storedAd === 'true';
            }
            if (clusterToggleInput) clusterToggleInput.checked = state.enableClustering;
            if (hideCompletedInput) hideCompletedInput.checked = state.hideCompleted;

            if (regionColorInput) {
                regionColorInput.value = state.savedRegionColor;
                const valDisplay = document.getElementById('region-line-color-value');
                if (valDisplay) valDisplay.textContent = state.savedRegionColor.toUpperCase();
            }
            if (regionFillColorInput) {
                regionFillColorInput.value = state.savedRegionFillColor;
                const valDisplay = document.getElementById('region-fill-color-value');
                if (valDisplay) valDisplay.textContent = state.savedRegionFillColor.toUpperCase();
            }
            updateClusteringToggleState();
            settingsModal.classList.remove('hidden');
        });

        const closeSettingsBtn = document.getElementById('close-settings');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                if (state.enableClustering !== initialClusteringState || state.gpuRenderMode !== initialGpuModeState) {
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

    if (clusterToggleInput) {
        clusterToggleInput.checked = state.enableClustering;
        clusterToggleInput.addEventListener('change', (e) => {
            setState('enableClustering', e.target.checked);
            localStorage.setItem('wwm_enable_clustering', state.enableClustering);
            triggerSync();
        });
    }

    if (gpuModeToggleInput) {
        gpuModeToggleInput.checked = state.gpuRenderMode;
        gpuModeToggleInput.addEventListener('change', (e) => {
            setState('gpuRenderMode', e.target.checked);
            localStorage.setItem('wwm_gpu_render', e.target.checked);
            updateClusteringToggleState();
            triggerSync();
        });
    }

    if (hideCompletedInput) {
        hideCompletedInput.addEventListener('change', (e) => {
            setState('hideCompleted', e.target.checked);
            localStorage.setItem('wwm_hide_completed', state.hideCompleted);
            triggerSync();
            renderMapDataAndMarkers();
        });
    }

    if (commentsToggleInput) {
        commentsToggleInput.checked = state.showComments;
        commentsToggleInput.addEventListener('change', (e) => {
            setState('showComments', e.target.checked);
            localStorage.setItem('wwm_show_comments', e.target.checked);
            triggerSync();
        });
    }

    if (closeOnCompleteInput) {
        closeOnCompleteInput.checked = state.closeOnComplete;
        closeOnCompleteInput.addEventListener('change', (e) => {
            setState('closeOnComplete', e.target.checked);
            localStorage.setItem('wwm_close_on_complete', e.target.checked);
            triggerSync();
        });
    }

    if (regionColorInput) {
        regionColorInput.addEventListener('input', (e) => {
            const valDisplay = document.getElementById('region-line-color-value');
            if (valDisplay) valDisplay.textContent = e.target.value.toUpperCase();
        });
    }
    if (regionFillColorInput) {
        regionFillColorInput.addEventListener('input', (e) => {
            const valDisplay = document.getElementById('region-fill-color-value');
            if (valDisplay) valDisplay.textContent = e.target.value.toUpperCase();
        });
    }
};
