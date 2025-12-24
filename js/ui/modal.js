import { state, setState } from '../state.js';
import { contributionLinks } from '../config.js';
import { t } from '../utils.js';
import { jumpToId } from './navigation.js';

export const openRelatedModal = (catId) => {
    const modal = document.getElementById('related-modal');
    const title = document.getElementById('modal-title');
    const listEl = document.getElementById('modal-list');
    const input = document.getElementById('modal-search-input');
    title.innerText = `${t(catId)} 전체 목록`;
    input.value = '';
    listEl.innerHTML = '';
    const currentModalList = state.allMarkers.filter(m => m.category === catId);
    setState('currentModalList', currentModalList);
    renderModalList(currentModalList);
    modal.classList.remove('hidden');
    input.focus();
};

export const closeModal = () => document.getElementById('related-modal').classList.add('hidden');

export const renderModalList = (items) => {
    const listEl = document.getElementById('modal-list');
    listEl.innerHTML = '';
    if (items.length === 0) {
        listEl.innerHTML = '<li style="padding:15px; text-align:center; color:#666;">결과가 없습니다.</li>';
        return;
    }
    const currComp = JSON.parse(localStorage.getItem('wwm_completed')) || [];
    items.forEach(m => {
        const displayRegion = m.forceRegion || m.region;
        let displayName = t(m.originalName || m.name);
        if (displayName) displayName = displayName.replace(/{region}/g, displayRegion);
        const isDone = currComp.includes(m.id);
        const statusHtml = isDone ? '<span class="modal-item-status">완료</span>' : '';

        const catObj = state.mapData.categories.find(c => c.id === m.category);
        const iconUrl = catObj ? catObj.image : './icons/17310010088.png';

        const li = document.createElement('li');
        li.className = 'modal-list-item';
        li.innerHTML = `
        <img src="${iconUrl}" class="modal-item-icon" alt="icon">
        <div class="modal-item-info">
            <div class="modal-item-name">${displayName}</div>
            <div class="modal-item-region">${displayRegion}</div>
        </div>
        ${statusHtml}
    `;
        li.onclick = () => { jumpToId(m.id); closeModal(); };
        listEl.appendChild(li);
    });
};

export const renderContributionModal = () => {
    const githubModalTitle = document.getElementById('github-modal-title');
    const githubModalDesc = document.getElementById('github-modal-desc');
    const linksContainer = document.getElementById('github-modal-links');
    const guideContainer = document.getElementById('contribution-guide-container');

    if (!githubModalTitle || !githubModalDesc || !linksContainer || !guideContainer) return;

    githubModalTitle.textContent = t("contribute_title");
    githubModalDesc.innerHTML = t("contribute_description").replace(/\n/g, '<br>');

    linksContainer.innerHTML = contributionLinks.map(link => `
        <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="github-link-card">
            <div class="github-card-icon">${link.icon === 'code' ? '💻' : '🐛'}</div>
            <div class="github-card-title">${t(link.titleKey)}</div>
            <div class="github-card-desc">${link.icon === 'code' ? 'Source Code' : 'Bug Reports'}</div>
        </a>
    `).join('');

    guideContainer.innerHTML = `
        <h1 style="margin-bottom: 15px; margin-left: 5px; font-size: 1.5rem;">${t("guide_trans_title")}</h1>
        <div class="guide-steps">${t("guide_trans_steps")}</div>
    `;
};
