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

    await loadMapData(state.currentMapKey);
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
};
