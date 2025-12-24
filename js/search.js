import { state } from './state.js';
import { t } from './utils.js';
import { saveFilterState } from './data.js';
import { renderMapDataAndMarkers } from './map.js';
import { updateToggleButtonsState } from './ui.js';

export const initSearch = () => {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (!searchInput) return;

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
                    div.onclick = () => handleRegionClick(r, searchInput, searchResults);
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
};

const handleRegionClick = (region, searchInput, searchResults) => {
    searchInput.value = t(region);
    searchResults.classList.add('hidden');

    state.activeRegionNames.clear();
    state.activeRegionNames.add(region);

    const regBtns = document.querySelectorAll('#region-list .cate-item');
    regBtns.forEach(btn => {
        if (btn.dataset.region === region) {
            btn.classList.add('active');
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            btn.classList.remove('active');
        }
    });

    updateToggleButtonsState();
    renderMapDataAndMarkers();
    saveFilterState();

    const meta = state.regionMetaInfo[region];
    if (meta) {
        state.map.flyTo([meta.lat, meta.lng], meta.zoom, {
            animate: true,
            duration: 1.0
        });
    }
};

export const initModalSearch = (renderModalList) => {
    const modalSearchInput = document.getElementById('modal-search-input');
    if (modalSearchInput) {
        modalSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = state.currentModalList.filter(m => m.name.includes(term));
            renderModalList(filtered);
        });
    }
};
