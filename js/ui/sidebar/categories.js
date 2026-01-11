import { state } from '../../state.js';
import { t } from '../../utils.js';
import { saveFilterState } from '../../data.js';
import { updateMapVisibility } from '../../map.js';
import { CATEGORY_GROUPS, EYE_OPEN_SVG, EYE_OFF_SVG } from './constants.js';
import { updateToggleButtonsState } from './core.js';
import { setAllRegions } from './regions.js';

export const setAllCategories = (isActive) => {
    const catBtns = document.querySelectorAll('#category-list .cate-item');
    state.activeCategoryIds.clear();
    const validCategories = state.mapData.categories;

    if (isActive) {
        validCategories.forEach(c => state.activeCategoryIds.add(c.id));
        catBtns.forEach(btn => btn.classList.add('active'));
    } else {
        catBtns.forEach(btn => btn.classList.remove('active'));
    }
    updateToggleButtonsState();
    updateMapVisibility();
    saveFilterState();
};

import { lazyLoader } from '../lazy-loader.js';

export const refreshCategoryList = () => {
    const categoryListEl = document.getElementById('category-list');
    if (!categoryListEl) return;
    categoryListEl.innerHTML = '';

    const validCategories = state.mapData.categories;

    for (const [groupKey, groupInfo] of Object.entries(CATEGORY_GROUPS)) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'category-group';

        const groupTitle = document.createElement('h3');
        groupTitle.className = 'group-name';

        const titleText = document.createElement('span');
        titleText.textContent = groupInfo.title;
        groupTitle.appendChild(titleText);

        const groupToggleBtn = document.createElement('button');
        groupToggleBtn.className = 'group-toggle-btn';
        groupToggleBtn.title = `${groupInfo.title} 모두 켜기/끄기`;
        groupToggleBtn.dataset.group = groupKey;

        const groupCategoryIds = groupInfo.ids.filter(id => validCategories.some(c => c.id === id));
        const allGroupActive = groupCategoryIds.length > 0 && groupCategoryIds.every(id => state.activeCategoryIds.has(id));

        groupToggleBtn.innerHTML = allGroupActive ? EYE_OFF_SVG : EYE_OPEN_SVG;
        groupToggleBtn.classList.toggle('all-active', allGroupActive);

        groupToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentGroupIds = groupInfo.ids.filter(id => validCategories.some(c => c.id === id));
            const currentAllActive = currentGroupIds.every(id => state.activeCategoryIds.has(id));

            if (currentAllActive) {
                currentGroupIds.forEach(id => state.activeCategoryIds.delete(id));
            } else {
                currentGroupIds.forEach(id => state.activeCategoryIds.add(id));
                if (state.activeRegionNames.size === 0) setAllRegions(true);
            }

            const catBtns = groupDiv.querySelectorAll('.cate-item');
            catBtns.forEach(btn => {
                const catId = btn.dataset.id;
                btn.classList.toggle('active', state.activeCategoryIds.has(catId));
            });

            const nowAllActive = currentGroupIds.every(id => state.activeCategoryIds.has(id));
            groupToggleBtn.innerHTML = nowAllActive ? EYE_OFF_SVG : EYE_OPEN_SVG;
            groupToggleBtn.classList.toggle('all-active', nowAllActive);

            updateToggleButtonsState();
            updateMapVisibility();
            saveFilterState();
        });

        groupTitle.appendChild(groupToggleBtn);
        groupDiv.appendChild(groupTitle);

        const cateListDiv = document.createElement('div');
        cateListDiv.className = 'cate-list';

        const groupCategories = validCategories.filter(cat => groupInfo.ids.includes(cat.id));
        groupCategories.sort((a, b) => t(a.name).localeCompare(t(b.name), 'ko'));

        groupCategories.forEach(cat => {
            const btn = document.createElement('div');
            btn.className = state.activeCategoryIds.has(cat.id) ? 'cate-item active' : 'cate-item';
            btn.dataset.id = cat.id;

            const items = state.itemsByCategory[cat.id] || [];
            const count = items.length;

            let transCount = 0;
            items.forEach(i => {
                if (i.isTranslated || state.koDict[i.name] || state.koDict[i.name.trim()]) {
                    transCount++;
                }
            });

            const percent = count > 0 ? Math.round((transCount / count) * 100) : 0;
            let progressClass = '';
            if (percent === 100) progressClass = 'done';
            else if (percent >= 70) progressClass = 'high';
            else if (percent >= 30) progressClass = 'mid';
            else if (percent > 0) progressClass = 'low';

            // Use lazy loading for category icons
            // Use a transparent 1x1 pixel as placeholder or a loading spinner
            const placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

            btn.innerHTML = `
                <span class="cate-icon"><img data-src="${cat.image}" src="${placeholder}" class="lazy-load" alt=""></span>
                <div class="cate-info">
                    <div class="cate-name"><span>${t(cat.name)}</span></div>
                    <div class="cate-meta">
                        <span class="cate-count">${count}</span>
                        <span class="cate-trans-stat ${progressClass}">${percent}% 한글화</span>
                    </div>
                </div>
            `;

            btn.addEventListener('mouseenter', () => {
                const nameWrapper = btn.querySelector('.cate-name');
                const nameSpan = nameWrapper.querySelector('span');
                if (nameWrapper && nameSpan) {
                    const overflow = nameWrapper.scrollWidth - nameWrapper.clientWidth;
                    if (overflow > 0) {
                        nameSpan.style.setProperty('--scroll-dist', `-${overflow + 10}px`);
                        nameWrapper.classList.add('is-long');
                    } else {
                        nameWrapper.classList.remove('is-long');
                    }
                }
            });

            btn.addEventListener('mouseleave', () => {
                const nameWrapper = btn.querySelector('.cate-name');
                if (nameWrapper) {
                    nameWrapper.classList.remove('is-long');
                }
            });

            btn.addEventListener('click', () => {
                if (state.activeCategoryIds.has(cat.id)) {
                    state.activeCategoryIds.delete(cat.id);
                    btn.classList.remove('active');
                } else {
                    state.activeCategoryIds.add(cat.id);
                    btn.classList.add('active');
                    if (state.activeRegionNames.size === 0) setAllRegions(true);
                }
                updateMapVisibility();
                updateToggleButtonsState();
                saveFilterState();
            });
            cateListDiv.appendChild(btn);
        });

        if (groupCategories.length > 0) {
            groupDiv.appendChild(cateListDiv);
            categoryListEl.appendChild(groupDiv);
        }
    }

    updateToggleButtonsState();

    // Observe all lazy images in the list
    lazyLoader.observeAll('.lazy-load', categoryListEl);
};
