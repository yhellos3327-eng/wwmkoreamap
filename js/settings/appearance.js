import { state, setState } from '../state.js';
import { applyTheme, getTheme } from '../theme.js';

export const applyMenuPosition = (position) => {
    document.body.classList.remove('menu-pos-left', 'menu-pos-center', 'menu-pos-right');
    document.body.classList.add(`menu-pos-${position}`);
};

export const initAppearanceSettings = () => {
    const regionColorInput = document.getElementById('region-line-color');
    const regionFillColorInput = document.getElementById('region-fill-color');
    const menuPositionSelect = document.getElementById('menu-position-select');
    const themeSelect = document.getElementById('theme-select');

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

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });
    }

    return {
        loadValues: () => {
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
            if (themeSelect) {
                themeSelect.value = getTheme();
            }
        }
    };
};

export const saveAppearanceSettings = () => {
    const regionColorInput = document.getElementById('region-line-color');
    const regionFillColorInput = document.getElementById('region-fill-color');

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
};
