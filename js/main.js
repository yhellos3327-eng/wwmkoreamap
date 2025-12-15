import { state, setState } from './state.js';
import { MAP_CONFIGS, contributionLinks } from './config.js';
import { t, parseCSV } from './utils.js';
import { loadMapData, saveFilterState } from './data.js';
import { renderMapDataAndMarkers, createPopupHtml, moveToLocation } from './map.js';
import {
    toggleSidebar, refreshCategoryList, setAllCategories, setAllRegions, updateToggleButtonsState,
    renderFavorites, renderLinks, renderUpdates, initCustomDropdown, renderContributionModal,
    openRelatedModal, closeModal, renderModalList, openLightbox, switchLightbox, closeLightbox,
    openVideoLightbox, closeVideoLightbox, viewFullImage, switchImage, initGuide,
    toggleCompleted, toggleFavorite, shareLocation, expandRelated, jumpToId
} from './ui.js';
import { translateItem } from './translation.js';
import { enableDevMode } from './dev.js';

window.toggleSidebar = toggleSidebar;
window.openLightbox = openLightbox;
window.switchImage = switchImage;
window.switchLightbox = switchLightbox;
window.openVideoLightbox = openVideoLightbox;
window.closeVideoLightbox = closeVideoLightbox;
window.viewFullImage = viewFullImage;
window.closeLightbox = closeLightbox;
window.translateItem = translateItem;
window.jumpToId = jumpToId;
window.expandRelated = expandRelated;
window.openRelatedModal = openRelatedModal;
window.closeModal = closeModal;
window.renderModalList = renderModalList;
window.toggleCompleted = toggleCompleted;
window.toggleFavorite = toggleFavorite;
window.shareLocation = shareLocation;
window.moveToLocation = moveToLocation;
window.enableDevMode = enableDevMode;

const initAdToggle = () => {
    const adContainer = document.querySelector('.ad-container');
    const toggleAd = document.getElementById('toggle-ad');

    if (!adContainer || !toggleAd) return;

    const showAd = localStorage.getItem('wwm_show_ad') === 'true';
    toggleAd.checked = showAd;
    adContainer.style.display = showAd ? 'block' : 'none';

    toggleAd.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        localStorage.setItem('wwm_show_ad', isChecked);
        adContainer.style.display = isChecked ? 'block' : 'none';
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [transRes] = await Promise.all([
            fetch('./translation.csv')
        ]);

        if (!transRes.ok) throw new Error("필수 파일을 찾을 수 없습니다.");

        const githubModal = document.getElementById('github-modal');
        const openGithubModalBtn = document.getElementById('open-github-modal');
        const githubModalTitle = document.getElementById('github-modal-title');
        const githubModalDesc = document.getElementById('github-modal-desc');
        const githubModalLinks = document.getElementById('github-modal-links');

        const urlParams = new URLSearchParams(window.location.search);
        const mapParam = urlParams.get('map');
        const isEmbed = urlParams.get('embed') === 'true';

        if (mapParam && MAP_CONFIGS[mapParam]) {
            setState('currentMapKey', mapParam);
        }
        if (isEmbed) {
            document.body.classList.add('embed-mode');
            const sidebar = document.getElementById('sidebar');
            const openBtn = document.getElementById('open-sidebar');

            sidebar.classList.remove('open');
            sidebar.classList.add('collapsed');
            if (openBtn) openBtn.classList.remove('hidden-btn');
        }

        const originalBtn = document.getElementById('btn-open-original');
        if (originalBtn) {
            originalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetUrl = new URL(window.location.href);
                targetUrl.searchParams.delete('embed');
                targetUrl.searchParams.set('map', state.currentMapKey);

                window.open(targetUrl.toString(), '_blank');
            });
        }

        if (openGithubModalBtn && githubModal) {
            openGithubModalBtn.addEventListener('click', () => {
                renderContributionModal();
                githubModal.classList.remove('hidden');
            });
        }

        const settingsModal = document.getElementById('settings-modal');
        const openSettingsBtn = document.getElementById('open-settings');
        const saveApiKeyBtn = document.getElementById('save-api-key');
        const apiKeyInput = document.getElementById('api-key-input');
        const regionColorInput = document.getElementById('region-line-color');
        const regionFillColorInput = document.getElementById('region-fill-color');
        const adToggleInput = document.getElementById('toggle-ad');

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

        const hideCompletedInput = document.getElementById('toggle-hide-completed');
        if (hideCompletedInput) {
            hideCompletedInput.checked = state.hideCompleted;
            hideCompletedInput.addEventListener('change', (e) => {
                setState('hideCompleted', e.target.checked);
                localStorage.setItem('wwm_hide_completed', state.hideCompleted);
                renderMapDataAndMarkers();
            });
        }

        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                apiKeyInput.value = state.savedApiKey;
                if (adToggleInput) adToggleInput.checked = localStorage.getItem('wwm_show_ad') === 'true';
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
                settingsModal.classList.remove('hidden');
            });
        }
        if (saveApiKeyBtn) {
            saveApiKeyBtn.addEventListener('click', (event) => {
                event.preventDefault();

                try {
                    if (apiKeyInput) {
                        const newKey = apiKeyInput.value.trim();
                        setState('savedApiKey', newKey);
                        localStorage.setItem('wwm_api_key', newKey);
                    } else {
                        console.error("오류: apiKeyInput 요소를 찾을 수 없습니다.");
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
                        let savedShowAd = adToggleInput.checked;
                        localStorage.setItem('wwm_show_ad', savedShowAd);
                    }
                    alert("옵션 저장되었습니다.");
                    if (settingsModal) settingsModal.classList.add('hidden');
                    renderMapDataAndMarkers();

                } catch (error) {
                    console.error("저장 중 에러 발생:", error);
                    alert("설정 저장 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
                }
            });
        } else {
            console.error("오류: saveApiKeyBtn 버튼을 찾을 수 없습니다.");
        }

        const transText = await transRes.text();
        const csvData = parseCSV(transText);

        setState('rawCSV', transText);
        setState('parsedCSV', csvData);

        if (csvData.length > 0) {
            const headers = csvData[0].map(h => h.trim());
            const typeIdx = headers.indexOf('Type');
            const catIdx = headers.indexOf('Category');
            const keyIdx = headers.indexOf('Key');
            const valIdx = headers.indexOf('Korean');
            const descIdx = headers.indexOf('Description');
            const regIdx = headers.indexOf('Region');

            for (let i = 1; i < csvData.length; i++) {
                const row = csvData[i];
                if (row.length < 3) continue;

                const type = row[typeIdx]?.trim();
                const key = row[keyIdx]?.trim();
                if (!key) continue;

                if (type === 'Common') {
                    const val = row[valIdx];
                    if (val) {
                        state.koDict[key] = val;
                        state.koDict[key.trim()] = val;
                    }
                } else if (type === 'Override') {
                    const catId = row[catIdx]?.trim();
                    if (!catId) continue;

                    if (!state.categoryItemTranslations[catId]) {
                        state.categoryItemTranslations[catId] = {};
                    }

                    if (key === '_common_description') {
                        state.categoryItemTranslations[catId]._common_description = row[descIdx];
                    } else {
                        const imgIdx = headers.indexOf('Image');
                        let desc = row[descIdx];
                        if (desc) {
                            desc = desc.replace(/<hr>/g, '<hr style="border: 0; border-bottom: 1px solid var(--border); margin: 10px 0;">');
                        }

                        let imagePath = imgIdx !== -1 ? row[imgIdx] : null;
                        if (imagePath && imagePath.includes('{id}')) {
                            imagePath = imagePath.replace('{id}', key);
                        }

                        state.categoryItemTranslations[catId][key] = {
                            name: row[valIdx],
                            description: desc,
                            region: row[regIdx],
                            image: imagePath
                        };
                    }
                }
            }
        }

        initCustomDropdown();

        await loadMapData(state.currentMapKey);

        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.trim().toLowerCase();

                if (term === '') {
                    state.allMarkers.forEach(m => m.marker.setOpacity(1));
                    if (searchResults) searchResults.classList.add('hidden');
                    return;
                }

                state.allMarkers.forEach(m => {
                    const regionName = t(m.region).toLowerCase();
                    const categoryName = t(m.category).toLowerCase();
                    const isMatch = m.name.includes(term) || m.desc.includes(term) || regionName.includes(term) || categoryName.includes(term);
                    m.marker.setOpacity(isMatch ? 1 : 0.1);
                });

                if (searchResults) {
                    searchResults.innerHTML = '';
                    const matchedRegions = Array.from(state.uniqueRegions).filter(r => t(r).toLowerCase().includes(term));

                    if (matchedRegions.length > 0) {
                        matchedRegions.forEach(r => {
                            const div = document.createElement('div');
                            div.className = 'search-result-item';
                            div.innerHTML = `<span>${t(r)}</span> <span class="search-result-type">지역</span>`;
                            div.onclick = () => {
                                searchInput.value = t(r);
                                searchResults.classList.add('hidden');

                                if (state.activeRegionNames.has(r)) {
                                    state.activeRegionNames.clear();
                                    state.activeRegionNames.add(r);
                                } else {
                                    state.activeRegionNames.clear();
                                    state.activeRegionNames.add(r);
                                }

                                const regBtns = document.querySelectorAll('#region-list .cate-item');
                                regBtns.forEach(btn => {
                                    if (btn.dataset.region === r) {
                                        btn.classList.add('active');
                                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    } else {
                                        btn.classList.remove('active');
                                    }
                                });

                                updateToggleButtonsState();
                                renderMapDataAndMarkers();
                                saveFilterState();

                                const meta = state.regionMetaInfo[r];
                                if (meta) {
                                    state.map.flyTo([meta.lat, meta.lng], meta.zoom, {
                                        animate: true,
                                        duration: 1.0
                                    });
                                }
                            };
                            searchResults.appendChild(div);
                        });
                        searchResults.classList.remove('hidden');
                    } else {
                        searchResults.classList.add('hidden');
                    }
                }
            });

            searchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (searchResults) searchResults.classList.add('hidden');
                }, 200);
            });

            searchInput.addEventListener('focus', () => {
                if (searchInput.value.trim() !== '' && searchResults && searchResults.children.length > 0) {
                    searchResults.classList.remove('hidden');
                }
            });
        }

        const tabs = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetId = tab.getAttribute('data-tab');
                tabContents.forEach(c => {
                    c.classList.remove('active');
                    if (c.id === targetId) c.classList.add('active');
                });
            });
        });

        const btnToggleCat = document.getElementById('btn-toggle-cat');
        const btnToggleReg = document.getElementById('btn-toggle-reg');
        if (btnToggleCat) {
            btnToggleCat.addEventListener('click', () => {
                const validCats = state.mapData.categories;
                const allActive = state.activeCategoryIds.size === validCats.length;
                setAllCategories(!allActive);
            });
        }
        if (btnToggleReg) {
            btnToggleReg.addEventListener('click', () => {
                const allActive = state.activeRegionNames.size === state.uniqueRegions.size;
                setAllRegions(!allActive);
            });
        }

        const openBtn = document.getElementById('open-sidebar');
        const closeBtn = document.getElementById('toggle-sidebar');
        if (openBtn) openBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSidebar('open'); });
        if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar('close'));
        window.addEventListener('resize', () => { if (state.map) state.map.invalidateSize(); });

        const modalSearchInput = document.getElementById('modal-search-input');
        if (modalSearchInput) {
            modalSearchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = state.currentModalList.filter(m => m.name.includes(term));
                renderModalList(filtered);
            });
        }
        const relatedModal = document.getElementById('related-modal');
        if (relatedModal) {
            relatedModal.addEventListener('click', (e) => {
                if (e.target.id === 'related-modal') closeModal();
            });
        }

        renderFavorites();
        renderLinks();
        renderUpdates();

        initAdToggle();

        const saveBtn = document.getElementById('btn-backup-save');
        const loadBtn = document.getElementById('btn-backup-load');
        const fileInput = document.getElementById('inp-backup-file');
        if (saveBtn && loadBtn && fileInput) {
            saveBtn.addEventListener('click', () => {
                try {
                    const data = { ...localStorage };
                    if (Object.keys(data).length === 0) {
                        alert('저장할 데이터가 없습니다.');
                        return;
                    }
                    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    const fileName = `map_data_backup_${dateStr}.json`;
                    const jsonStr = JSON.stringify(data, null, 2);
                    const blob = new Blob([jsonStr], { type: "application/json" });
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                } catch (err) {
                    console.error('백업 실패:', err);
                    alert('데이터 저장 중 오류가 발생했습니다.');
                }
            });
            loadBtn.addEventListener('click', () => {
                if (confirm('⚠️ 주의!\n파일을 불러오면 현재 저장된 지도의 마커나 설정이 모두 사라지고 파일의 내용으로 교체됩니다.\n계속하시겠습니까?')) {
                    fileInput.click();
                }
            });
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();

                reader.onload = (event) => {
                    try {
                        const fileContent = event.target.result;
                        const parsedData = JSON.parse(fileContent);
                        if (typeof parsedData !== 'object' || parsedData === null) {
                            throw new Error('잘못된 JSON 형식');
                        }
                        localStorage.clear();
                        for (const key in parsedData) {
                            if (Object.prototype.hasOwnProperty.call(parsedData, key)) {
                                localStorage.setItem(key, parsedData[key]);
                            }
                        }

                        alert('✅ 데이터 복구가 완료되었습니다.\n적용을 위해 페이지를 새로고침합니다.');
                        location.reload();

                    } catch (err) {
                        console.error('복구 실패:', err);
                        alert('파일을 읽는 데 실패했습니다. 올바른 백업 파일인지 확인해 주세요.');
                    }
                };
                reader.readAsText(file);
                e.target.value = '';
            });
        }

        initGuide();

    } catch (error) {
        console.error("초기화 실패:", error);
        alert("맵 초기화에 실패했습니다.\n" + error.message);
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = parseInt(urlParams.get('id'));
    const sharedLat = parseFloat(urlParams.get('lat'));
    const sharedLng = parseFloat(urlParams.get('lng'));

    if (sharedId && !isNaN(sharedLat) && !isNaN(sharedLng)) {
        setTimeout(() => jumpToId(sharedId), 500);
    }


});

document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox-modal');
    if (!lightbox.classList.contains('hidden')) {
        if (e.key === "Escape") {
            closeLightbox();
        } else if (e.key === "ArrowLeft") {
            switchLightbox(-1);
        } else if (e.key === "ArrowRight") {
            switchLightbox(1);
        }
    }
});
