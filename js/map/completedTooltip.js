// @ts-check
import { state } from "../state.js";

let completedTooltipEl = null;

/**
 * Creates the completed marker tooltip element.
 * @returns {HTMLElement} The tooltip element.
 */
const createCompletedTooltip = () => {
  if (completedTooltipEl) return completedTooltipEl;

  const el = document.createElement("div");
  el.id = "completed-marker-tooltip";
  el.className = "completed-marker-tooltip";
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

/**
 * Shows the completed tooltip.
 * @param {any} e - The event object.
 * @param {string|number} itemId - The item ID.
 * @param {string} name - The item name.
 * @param {string|number} timestamp - The completion timestamp.
 */
export const showCompletedTooltip = (e, itemId, name, timestamp) => {
  const completedItem = state.completedList.find(
    (c) => String(c.id) === String(itemId),
  );
  if (!completedItem) {
    hideCompletedTooltip();
    return;
  }

  const tooltip = createCompletedTooltip();
  tooltip.querySelector(".tooltip-title").textContent = name;

  if (timestamp) {
    const date = new Date(timestamp);
    const timeStr = date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    tooltip.querySelector(".tooltip-time").textContent = `완료: ${timeStr}`;
  } else {
    tooltip.querySelector(".tooltip-time").textContent = `완료됨`;
  }

  const containerPoint =
    e.containerPoint || state.map.latLngToContainerPoint(e.latlng);
  const mapContainer = state.map.getContainer().getBoundingClientRect();

  tooltip.style.left = `${mapContainer.left + containerPoint.x}px`;
  tooltip.style.top = `${mapContainer.top + containerPoint.y - 30}px`;
  tooltip.classList.add("visible");
};

/**
 * Hides the completed tooltip.
 */
export const hideCompletedTooltip = () => {
  if (completedTooltipEl) {
    completedTooltipEl.classList.remove("visible");
  }
};
