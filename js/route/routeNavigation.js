// @ts-check
const L = /** @type {any} */ (window).L;
import { state as appState } from "../state.js";
import { logger } from "../logger.js";
import { getRouteState, setRouteState } from "./routeState.js";
import { updateRouteProgress } from "./routeUI.js";

/**
 * 경로의 특정 단계로 이동합니다.
 * @param {number} stepIndex - 이동할 단계 인덱스.
 */
export const goToStep = (stepIndex) => {
  const state = getRouteState();
  const { currentRoute, routeMarkers } = state;

  if (!currentRoute || stepIndex < 0 || stepIndex >= currentRoute.route.length)
    return;

  setRouteState("currentStepIndex", stepIndex);
  const point = currentRoute.route[stepIndex];

  if (appState.map) {
    appState.map.setView(
      [point.lat, point.lng],
      Math.max(appState.map.getZoom(), 14),
    );
  }

  routeMarkers.forEach((marker, index) => {
    const isCompleted = appState.completedList.some(
      (c) => c.id === currentRoute.route[index].id,
    );
    const isCurrent = index === stepIndex;

    const markerHtml = `
            <div class="route-badge-marker ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}">
                ${currentRoute.route[index].order}
            </div>
        `;

    const newIcon = L.divIcon({
      html: markerHtml,
      className: "route-badge-container",
      iconSize: [16, 16],
      iconAnchor: [8, 30],
    });

    marker.setIcon(newIcon);
    marker.setZIndexOffset(isCurrent ? 1000 : 100);
  });

  updateRouteProgress(currentRoute, stepIndex);
};

/**
 * 경로의 다음 단계로 이동합니다.
 */
export const nextStep = () => {
  const state = getRouteState();
  if (
    state.currentRoute &&
    state.currentStepIndex < state.currentRoute.route.length - 1
  ) {
    goToStep(state.currentStepIndex + 1);
  }
};

/**
 * 경로의 이전 단계로 이동합니다.
 */
export const prevStep = () => {
  const state = getRouteState();
  if (state.currentRoute && state.currentStepIndex > 0) {
    goToStep(state.currentStepIndex - 1);
  }
};

/**
 * 현재 단계를 완료하고 다음 단계로 이동합니다.
 */
export const completeCurrentStep = () => {
  const state = getRouteState();
  if (!state.currentRoute) return;

  const currentPoint = state.currentRoute.route[state.currentStepIndex];

  import("../ui.js").then(({ toggleCompleted }) => {
    if (!appState.completedList.some((c) => c.id === currentPoint.id)) {
      toggleCompleted(currentPoint.id);
    }

    for (
      let i = state.currentStepIndex + 1;
      i < state.currentRoute.route.length;
      i++
    ) {
      if (
        !appState.completedList.some(
          (c) => c.id === state.currentRoute.route[i].id,
        )
      ) {
        goToStep(i);
        return;
      }
    }

    logger.success("RouteMode", "Route completed! 🎉");
  });
};
