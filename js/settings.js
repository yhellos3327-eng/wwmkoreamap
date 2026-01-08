import { state, setState } from './state.js';
import { renderMapDataAndMarkers } from './map.js';
import { initAuth, updateAuthUI, isLoggedIn } from './auth.js';
import { triggerSync, updateSettingWithTimestamp, setLocalData } from './sync.js';
import { fetchBackupList, saveCloudBackup, restoreFromBackup } from './sync/api.js';
import { runIntegrityCheck, initIntegrityModal, closeIntegrityModal, showResultAlert, initResultAlertModal } from './integrity.js';

export const AI_MODELS = {
    gemini: [
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
        { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
        { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2 Pro' },
    ],
    openai: [
        { value: 'gpt-5', label: 'GPT-5' },
        { value: 'gpt-5-mini', label: 'GPT-5 mini' },
        { value: 'gpt-5-nano', label: 'GPT-5 nano' },
        { value: 'gpt-5.2-pro', label: 'GPT-5.2 pro' },
        { value: 'gpt-5.2', label: 'GPT 5.2' },
    ],
    claude: [
        { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
        { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
        { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
    ]
};

export const initAdToggle = () => {
    const adContainer = document.querySelector('.ad-container');
    const toggleAd = document.getElementById('toggle-ad');

    if (!adContainer || !toggleAd) return;

    const storedAd = localStorage.getItem('wwm_show_ad');
    const showAd = storedAd === null ? true : storedAd === 'true';
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

        const gpuSettingSelect = document.getElementById('gpu-setting-select');
        if (gpuSettingSelect) {
            localStorage.setItem('wwm_gpu_setting', gpuSettingSelect.value);
        }

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
    const gpuSettingSelect = document.getElementById('gpu-setting-select');

    let initialClusteringState = state.enableClustering;
    let initialGpuSetting = state.savedGpuSetting;

    const applyLowSpecMode = (isLowSpec) => {
        if (isLowSpec) {
            document.body.classList.add('low-spec-mode');
        } else {
            document.body.classList.remove('low-spec-mode');
        }
    };

    // 초기 로드 시 저사양 모드 적용 (GPU 설정이 'off'일 때)
    applyLowSpecMode(state.savedGpuSetting === 'off');

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
            initialGpuSetting = state.savedGpuSetting;

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
            if (gpuSettingSelect) gpuSettingSelect.value = state.savedGpuSetting;

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
                if (state.enableClustering !== initialClusteringState || state.savedGpuSetting !== initialGpuSetting) {
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
            updateSettingWithTimestamp('enable_clustering', e.target.checked);
        });
    }

    if (gpuSettingSelect) {
        gpuSettingSelect.value = state.savedGpuSetting;
        gpuSettingSelect.addEventListener('change', (e) => {
            state.savedGpuSetting = e.target.value;
            localStorage.setItem('wwm_gpu_setting', e.target.value);
            applyLowSpecMode(e.target.value === 'off');
            updateClusteringToggleState();
        });
    }

    if (hideCompletedInput) {
        hideCompletedInput.addEventListener('change', (e) => {
            setState('hideCompleted', e.target.checked);
            updateSettingWithTimestamp('hide_completed', e.target.checked);
            renderMapDataAndMarkers();
        });
    }

    if (commentsToggleInput) {
        commentsToggleInput.checked = state.showComments;
        commentsToggleInput.addEventListener('change', (e) => {
            setState('showComments', e.target.checked);
            updateSettingWithTimestamp('show_comments', e.target.checked);
        });
    }

    if (closeOnCompleteInput) {
        closeOnCompleteInput.checked = state.closeOnComplete;
        closeOnCompleteInput.addEventListener('change', (e) => {
            setState('closeOnComplete', e.target.checked);
            updateSettingWithTimestamp('close_on_complete', e.target.checked);
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

    const menuPositionSelect = document.getElementById('menu-position-select');
    if (menuPositionSelect) {
        menuPositionSelect.value = state.savedMenuPosition;
        applyMenuPosition(state.savedMenuPosition);

        menuPositionSelect.addEventListener('change', (e) => {
            const newPos = e.target.value;
            state.savedMenuPosition = newPos;
            localStorage.setItem('wwm_menu_position', newPos);
            applyMenuPosition(newPos);
        });
    }
    initCloudBackupSection();
};

export const applyMenuPosition = (position) => {
    document.body.classList.remove('menu-pos-left', 'menu-pos-center', 'menu-pos-right');
    document.body.classList.add(`menu-pos-${position}`);
};

const formatBackupDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const renderBackupList = (backups) => {
    const container = document.getElementById('cloud-backup-list');
    if (!container) return;

    if (!backups || backups.length === 0) {
        container.innerHTML = '<div class="backup-empty-state">저장된 백업이 없습니다.</div>';
        return;
    }

    container.innerHTML = backups.map((backup, index) => `
        <div class="backup-item" data-backup-id="${backup.id}">
            <div class="backup-info">
                <span class="backup-label">${backup.label || `백업 #${backups.length - index}`}</span>
                <span class="backup-date">${formatBackupDate(backup.created_at)}</span>
                <span class="backup-stats">완료: ${backup.completed_count || 0}개</span>
            </div>
            <button class="backup-restore-btn" data-backup-id="${backup.id}">복원</button>
        </div>
    `).join('');

    container.querySelectorAll('.backup-restore-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const backupId = e.target.dataset.backupId;

            try {
                btn.disabled = true;
                btn.textContent = '검사 중...';

                // 먼저 백업 데이터 가져오기
                const result = await restoreFromBackup(backupId);

                if (result.success && result.data) {
                    btn.textContent = '복원';
                    btn.disabled = false;

                    // 무결성 검사 실행 (콜백으로 실제 복원 수행)
                    runIntegrityCheck(result.data, async (validatedData) => {
                        try {
                            setLocalData(validatedData);
                            await showResultAlert('success', '복원 완료', '백업이 성공적으로 복원되었습니다. 페이지를 새로고침합니다.', true);
                        } catch (error) {
                            console.error('Restore failed:', error);
                            showResultAlert('error', '복원 실패', '복원에 실패했습니다: ' + error.message);
                        }
                    });
                } else {
                    throw new Error('백업 데이터를 가져올 수 없습니다.');
                }
            } catch (error) {
                console.error('Restore failed:', error);
                showResultAlert('error', '복원 실패', '복원에 실패했습니다: ' + error.message);
                btn.disabled = false;
                btn.textContent = '복원';
            }
        });
    });
};

const loadCloudBackups = async () => {
    const container = document.getElementById('cloud-backup-list');
    if (!container) return;

    container.innerHTML = '<div class="backup-loading">불러오는 중...</div>';

    try {
        const backups = await fetchBackupList();
        renderBackupList(backups);
    } catch (error) {
        console.error('Failed to load backups:', error);
        container.innerHTML = '<div class="backup-error">백업 목록을 불러올 수 없습니다.</div>';
    }
};

const initCloudBackupSection = () => {
    const cloudBackupSection = document.getElementById('cloud-backup-section');
    const saveBtn = document.getElementById('btn-cloud-backup-save');
    const openSettingsBtn = document.getElementById('open-settings');

    // 모달 초기화
    initIntegrityModal();
    initResultAlertModal();

    if (!cloudBackupSection) return;
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            setTimeout(() => {
                if (isLoggedIn()) {
                    cloudBackupSection.style.display = 'block';
                    loadCloudBackups();
                } else {
                    cloudBackupSection.style.display = 'none';
                }
            }, 100);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!isLoggedIn()) {
                showResultAlert('warning', '로그인 필요', '클라우드 백업을 사용하려면 로그인이 필요합니다.');
                return;
            }

            const label = prompt('백업 이름을 입력하세요 (선택사항):');

            try {
                saveBtn.disabled = true;
                saveBtn.textContent = '저장 중...';

                const result = await saveCloudBackup(label || null);
                if (result.success) {
                    showResultAlert('success', '백업 저장 완료', '클라우드에 백업이 성공적으로 저장되었습니다.');
                    loadCloudBackups();
                }
            } catch (error) {
                console.error('Backup save failed:', error);
                showResultAlert('error', '백업 실패', '백업 저장에 실패했습니다: ' + error.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `
                    <span class="icon-mask"
                        style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'/%3E%3Cpolyline points='17 21 17 13 7 13 7 21'/%3E%3Cpolyline points='7 3 7 8 15 8'/%3E%3C/svg%3E&quot;);"></span>
                    현재 상태를 클라우드에 스냅샷 저장
                `;
            }
        });
    }
};
