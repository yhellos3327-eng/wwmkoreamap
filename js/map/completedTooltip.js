import { state } from '../state.js';

let completedTooltipEl = null;

const createCompletedTooltip = () => {
    if (completedTooltipEl) return completedTooltipEl;

    const el = document.createElement('div');
    el.id = 'completed-marker-tooltip';
    el.className = 'completed-marker-tooltip';
    el.innerHTML = `
        <div class="tooltip-header">
            <span class="tooltip-check">✓</span>
            <span class="tooltip-title"></span>
        </div>
        <div class="tooltip-time"></div>
    `;
    document.body.appendChild(el);
    completedTooltipEl = el;
    return el;
};

export const showCompletedTooltip = (e, itemId, name, timestamp) => {
    const completedItem = state.completedList.find(c => c.id === itemId);
    if (!completedItem) {
        hideCompletedTooltip();
        return;
    }

    const tooltip = createCompletedTooltip();
    tooltip.querySelector('.tooltip-title').textContent = name;

    if (timestamp) {
        const date = new Date(timestamp);
        const timeStr = date.toLocaleString('ko-KR', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        tooltip.querySelector('.tooltip-time').textContent = `완료: ${timeStr}`;
    } else {
        tooltip.querySelector('.tooltip-time').textContent = `완료됨`;
    }

    const containerPoint = e.containerPoint || state.map.latLngToContainerPoint(e.latlng);
    const mapContainer = state.map.getContainer().getBoundingClientRect();

    tooltip.style.left = `${mapContainer.left + containerPoint.x}px`;
    tooltip.style.top = `${mapContainer.top + containerPoint.y - 30}px`;
    tooltip.classList.add('visible');
};

export const hideCompletedTooltip = () => {
    if (completedTooltipEl) {
        completedTooltipEl.classList.remove('visible');
    }
};
