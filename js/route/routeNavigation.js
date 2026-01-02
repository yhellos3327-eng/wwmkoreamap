import { state as appState } from '../state.js';
import { logger } from '../logger.js';
import { getRouteState, setRouteState } from './routeState.js';
import { updateRouteProgress } from './routeUI.js';

export const goToStep = (stepIndex) => {
    const state = getRouteState();
    const { currentRoute, routeMarkers } = state;

    if (!currentRoute || stepIndex < 0 || stepIndex >= currentRoute.route.length) return;

    setRouteState('currentStepIndex', stepIndex);
    const point = currentRoute.route[stepIndex];

    if (appState.map) {
        appState.map.setView([point.lat, point.lng], Math.max(appState.map.getZoom(), 14));
    }

    routeMarkers.forEach((marker, index) => {
        const isCompleted = appState.completedList.some(c => c.id === currentRoute.route[index].id);
        const isCurrent = index === stepIndex;

        const markerHtml = `
            <div class="route-badge-marker ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
                ${currentRoute.route[index].order}
            </div>
        `;

        const newIcon = L.divIcon({
            html: markerHtml,
            className: 'route-badge-container',
            iconSize: [16, 16],
            iconAnchor: [8, 30]
        });

        marker.setIcon(newIcon);
        marker.setZIndexOffset(isCurrent ? 1000 : 100);
    });

    updateRouteProgress(currentRoute, stepIndex);
};

export const nextStep = () => {
    const state = getRouteState();
    if (state.currentRoute && state.currentStepIndex < state.currentRoute.route.length - 1) {
        goToStep(state.currentStepIndex + 1);
    }
};

export const prevStep = () => {
    const state = getRouteState();
    if (state.currentRoute && state.currentStepIndex > 0) {
        goToStep(state.currentStepIndex - 1);
    }
};

export const completeCurrentStep = () => {
    const state = getRouteState();
    if (!state.currentRoute) return;

    const currentPoint = state.currentRoute.route[state.currentStepIndex];

    import('../ui.js').then(({ toggleCompleted }) => {
        if (!appState.completedList.some(c => c.id === currentPoint.id)) {
            toggleCompleted(currentPoint.id);
        }

        for (let i = state.currentStepIndex + 1; i < state.currentRoute.route.length; i++) {
            if (!appState.completedList.some(c => c.id === state.currentRoute.route[i].id)) {
                goToStep(i);
                return;
            }
        }

        logger.success('RouteMode', 'Route completed! 🎉');
    });
};
