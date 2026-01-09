import { state, setState } from '../state.js';
import { triggerSync, updateSettingWithTimestamp } from '../sync.js';
import { renderMapDataAndMarkers } from '../map.js';

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

export const applyLowSpecMode = (isLowSpec) => {
    if (isLowSpec) {
        document.body.classList.add('low-spec-mode');
    } else {
        document.body.classList.remove('low-spec-mode');
    }
};

export const updateClusteringToggleState = () => {
    const clusterToggleInput = document.getElementById('toggle-cluster');
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

export const initToggles = () => {
    const clusterToggleInput = document.getElementById('toggle-cluster');
    const hideCompletedInput = document.getElementById('toggle-hide-completed');
    const commentsToggleInput = document.getElementById('toggle-comments');
    const closeOnCompleteInput = document.getElementById('toggle-close-on-complete');
    const gpuSettingSelect = document.getElementById('gpu-setting-select');
    const adToggleInput = document.getElementById('toggle-ad');

    applyLowSpecMode(state.savedGpuSetting === 'off');

    // Chrome 내장 번역 상태 카드 (토글 없이 상태만 표시)
    const chromeTranslatorStatus = document.getElementById('chrome-translator-status');

    if (chromeTranslatorStatus) {
        // 상태 카드 항상 표시
        chromeTranslatorStatus.style.display = 'block';

        // Chrome 상태 UI 업데이트 헬퍼 함수
        const updateChromeStatusUI = (status) => {
            const badge = document.getElementById('chrome-badge');
            const translatorStatusEl = document.getElementById('translator-status');
            const detectorStatusEl = document.getElementById('detector-status');

            const getStatusText = (s) => {
                switch (s) {
                    case 'available': return '준비됨';
                    case 'downloadable': return '다운로드 필요';
                    case 'downloading': return '다운로드 중...';
                    case 'unavailable': return '사용 불가';
                    default: return s || '알 수 없음';
                }
            };

            const getStatusClass = (s) => {
                if (s === 'available') return 'available';
                if (s === 'downloadable' || s === 'downloading') return 'downloadable';
                return 'unavailable';
            };

            if (!status.supported) {
                if (badge) {
                    badge.className = 'chrome-badge unavailable';
                    badge.querySelector('span').textContent = '미지원';
                }
                if (translatorStatusEl) {
                    translatorStatusEl.textContent = '미지원';
                    translatorStatusEl.className = 'chrome-status-value unavailable';
                }
                if (detectorStatusEl) {
                    detectorStatusEl.textContent = '미지원';
                    detectorStatusEl.className = 'chrome-status-value unavailable';
                }
            } else {
                // 전체 상태 뱃지
                let overallStatus = 'available';
                if (status.translatorStatus !== 'available' || status.detectorStatus !== 'available') {
                    overallStatus = (status.translatorStatus === 'downloadable' || status.detectorStatus === 'downloadable')
                        ? 'downloadable' : 'unavailable';
                }

                const badgeTexts = {
                    available: '사용 가능',
                    downloadable: '다운로드 필요',
                    unavailable: '사용 불가'
                };

                if (badge) {
                    badge.className = `chrome-badge ${overallStatus}`;
                    badge.querySelector('span').textContent = badgeTexts[overallStatus];
                }

                if (translatorStatusEl) {
                    translatorStatusEl.textContent = getStatusText(status.translatorStatus);
                    translatorStatusEl.className = `chrome-status-value ${getStatusClass(status.translatorStatus)}`;
                }
                if (detectorStatusEl) {
                    detectorStatusEl.textContent = getStatusText(status.detectorStatus);
                    detectorStatusEl.className = `chrome-status-value ${getStatusClass(status.detectorStatus)}`;
                }
            }
        };

        // 설정 모달 열릴 때 상태 확인
        setTimeout(async () => {
            try {
                const { checkStatus } = await import('../chromeTranslator.js');
                const status = await checkStatus();
                updateChromeStatusUI(status);
            } catch (err) {
                console.error('Chrome 번역 상태 확인 실패:', err);
                const badge = document.getElementById('chrome-badge');
                if (badge) {
                    badge.className = 'chrome-badge unavailable';
                    badge.querySelector('span').textContent = '확인 실패';
                }
            }
        }, 100);
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

    return {
        loadValues: () => {
            if (adToggleInput) {
                const storedAd = localStorage.getItem('wwm_show_ad');
                adToggleInput.checked = storedAd === null ? true : storedAd === 'true';
            }
            if (clusterToggleInput) clusterToggleInput.checked = state.enableClustering;
            if (hideCompletedInput) hideCompletedInput.checked = state.hideCompleted;
            if (gpuSettingSelect) gpuSettingSelect.value = state.savedGpuSetting;

            updateClusteringToggleState();
        },
        getInitialState: () => ({
            clustering: state.enableClustering,
            gpuSetting: state.savedGpuSetting,
            useChromeTranslator: state.useChromeTranslator
        })
    };
};

export const saveToggleSettings = () => {
    const adToggleInput = document.getElementById('toggle-ad');
    const gpuSettingSelect = document.getElementById('gpu-setting-select');

    if (adToggleInput) {
        localStorage.setItem('wwm_show_ad', adToggleInput.checked);
    }
    if (gpuSettingSelect) {
        localStorage.setItem('wwm_gpu_setting', gpuSettingSelect.value);
    }
};
