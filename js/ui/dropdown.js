import { state, setState } from '../state.js';
import { MAP_CONFIGS } from '../config.js';
import { loadMapData } from '../data.js';

export const handleMapSelection = async (key, config, customSelect, optionsContainer, selectedText, optionDiv) => {
    if (state.currentMapKey === key) {
        customSelect.classList.remove('open');
        return;
    }

    setState('currentMapKey', key);
    if (selectedText) selectedText.textContent = config.name;

    const allOptions = optionsContainer.querySelectorAll('.custom-option');
    allOptions.forEach(opt => opt.classList.remove('selected'));
    optionDiv.classList.add('selected');

    customSelect.classList.remove('open');

    syncDropdowns(key, config.name);

    await loadMapData(state.currentMapKey);
};

const syncDropdowns = (key, name) => {
    const selectors = ['custom-map-select', 'sidebar-map-select'];
    selectors.forEach(selectorId => {
        const select = document.getElementById(selectorId);
        if (!select) return;

        const selectedText = select.querySelector('.selected-text');
        if (selectedText) selectedText.textContent = name;

        const options = select.querySelectorAll('.custom-option');
        options.forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === key);
        });
    });
};

export const createDropdownOption = (key, config, customSelect, optionsContainer, selectedText) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = `custom-option ${key === state.currentMapKey ? 'selected' : ''}`;
    optionDiv.dataset.value = key;
    optionDiv.textContent = config.name;

    optionDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMapSelection(key, config, customSelect, optionsContainer, selectedText, optionDiv);
    });

    return optionDiv;
};

export const setupDropdownEvents = (customSelect, trigger) => {
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelect.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            customSelect.classList.remove('open');
        }
    });
};

export const initCustomDropdown = () => {
    const customSelect = document.getElementById('custom-map-select');
    if (!customSelect) return;

    const trigger = customSelect.querySelector('.select-trigger');
    const optionsContainer = customSelect.querySelector('.select-options');
    const selectedText = customSelect.querySelector('.selected-text');

    optionsContainer.innerHTML = '';

    Object.keys(MAP_CONFIGS).forEach(key => {
        const config = MAP_CONFIGS[key];
        const optionDiv = createDropdownOption(key, config, customSelect, optionsContainer, selectedText);
        optionsContainer.appendChild(optionDiv);
    });

    if (MAP_CONFIGS[state.currentMapKey] && selectedText) {
        selectedText.textContent = MAP_CONFIGS[state.currentMapKey].name;
    }

    setupDropdownEvents(customSelect, trigger);

    initSidebarDropdown();
};

export const initSidebarDropdown = () => {
    const sidebarSelect = document.getElementById('sidebar-map-select');
    if (!sidebarSelect) return;

    const trigger = sidebarSelect.querySelector('.select-trigger');
    const optionsContainer = sidebarSelect.querySelector('.select-options');
    const selectedText = sidebarSelect.querySelector('.selected-text');

    optionsContainer.innerHTML = '';

    Object.keys(MAP_CONFIGS).forEach(key => {
        const config = MAP_CONFIGS[key];
        const optionDiv = createDropdownOption(key, config, sidebarSelect, optionsContainer, selectedText);
        optionsContainer.appendChild(optionDiv);
    });

    if (MAP_CONFIGS[state.currentMapKey] && selectedText) {
        selectedText.textContent = MAP_CONFIGS[state.currentMapKey].name;
    }

    setupDropdownEvents(sidebarSelect, trigger);

    const sidebarRouteBtn = document.getElementById('sidebar-route-toggle');
    if (sidebarRouteBtn) {
        sidebarRouteBtn.addEventListener('click', async () => {
            const { toggleRouteMode } = await import('../route/index.js');
            const isActive = toggleRouteMode();
            sidebarRouteBtn.classList.toggle('active', isActive);
            const topRouteBtn = document.getElementById('route-mode-toggle');
            if (topRouteBtn) topRouteBtn.classList.toggle('active', isActive);
        });
    }
};
