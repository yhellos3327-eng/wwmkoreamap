import { state as appState } from '../state.js';
import { logger } from '../logger.js';
import { getRouteState, setRouteState, resetRouteState } from './routeState.js';
import { renderRouteUI, hideRouteUI, updateRouteProgress } from './routeUI.js';
import { getItemsForRoute, findBoundaryStone, calculateOptimalRoute } from './routeCalculator.js';
import { goToStep } from './routeNavigation.js';

const EXCLUDED_REGIONS = ['all', '전체 지역', '지역 미할당', '알 수 없음', 'Unknown'];

export const toggleRouteMode = () => {
    const state = getRouteState();
    if (state.active) {
        exitRouteMode();
    } else {
        enterRouteMode();
    }
    return !state.active;
};

export const enterRouteMode = () => {
    setRouteState('active', true);
    setRouteState('previousRegionState', new Set(appState.activeRegionNames));
    logger.log('RouteMode', 'Entering route mode');
    renderRouteUI();
};

export const exitRouteMode = () => {
    clearRouteDisplay();
    hideRouteUI();
    restoreAllRegions();
    resetRouteState();
    logger.log('RouteMode', 'Exiting route mode');
};

const restoreAllRegions = () => {
    appState.activeRegionNames.clear();
    appState.uniqueRegions.forEach(r => appState.activeRegionNames.add(r));

    import('../ui/sidebar.js').then(module => {
        if (module.renderRegionButtons) {
            module.renderRegionButtons();
        }
    }).catch(() => { });

    import('../map/markers.js').then(module => {
        if (module.renderMapDataAndMarkers) {
            module.renderMapDataAndMarkers();
        }
    }).catch(() => { });
};

const setOnlyRegionActive = (region) => {
    appState.activeRegionNames.clear();
    appState.activeRegionNames.add(region);

    // Trigger re-render
    import('../ui/sidebar.js').then(module => {
        if (module.renderRegionButtons) {
            module.renderRegionButtons();
        }
    }).catch(() => { });

    import('../map/markers.js').then(module => {
        if (module.renderMapDataAndMarkers) {
            module.renderMapDataAndMarkers();
        }
    }).catch(() => { });
};

export const generateRoute = (region, categories = [], excludeCompleted = true) => {
    if (!appState.mapData || !appState.mapData.items) {
        logger.error('RouteMode', 'No map data available');
        return null;
    }

    const completedIds = excludeCompleted
        ? new Set(appState.completedList.map(c => c.id))
        : new Set();

    const items = getItemsForRoute(appState.mapData, region, categories, completedIds);

    if (items.length === 0) {
        logger.warn('RouteMode', 'No items found for route');
        return null;
    }

    const startPoint = findBoundaryStone(appState.mapData, region);
    const result = calculateOptimalRoute(items, startPoint, { useOptimization: true });

    const route = {
        ...result,
        region,
        categories,
        startPoint,
        createdAt: new Date().toISOString()
    };

    setRouteState('currentRoute', route);
    setRouteState('currentStepIndex', 0);

    if (region && region !== 'all') {
        setOnlyRegionActive(region);
    }

    logger.success('RouteMode', `Generated route with ${result.pointCount} points`);

    return route;
};

export const displayRoute = () => {
    const state = getRouteState();
    if (!state.currentRoute || !appState.map) return;

    clearRouteDisplay();

    const { route } = state.currentRoute;

    const polylineCoords = route.map(point => [point.lat, point.lng]);

    if (!appState.map.getPane('routePane')) {
        appState.map.createPane('routePane');
        appState.map.getPane('routePane').style.zIndex = 650;
        appState.map.getPane('routePane').style.pointerEvents = 'none';
    }

    const polyline = L.polyline(polylineCoords, {
        color: '#daac71',
        weight: 4,
        opacity: 0.9,
        pane: 'routePane',
        className: 'route-polyline'
    }).addTo(appState.map);

    setRouteState('routePolyline', polyline);

    const markers = [];
    route.forEach((point, index) => {
        const isCompleted = appState.completedList.some(c => c.id === point.id);
        const isCurrent = index === state.currentStepIndex;

        // Small badge positioned above the game icon
        const markerHtml = `
            <div class="route-badge-marker ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
                ${point.order}
            </div>
        `;

        const icon = L.divIcon({
            html: markerHtml,
            className: 'route-badge-container',
            iconSize: [16, 16],
            iconAnchor: [8, 30]  // Positioned above the game icon
        });

        const marker = L.marker([point.lat, point.lng], {
            icon,
            pane: 'routePane',
            zIndexOffset: isCurrent ? 1000 : 100,
            interactive: false  // Allow clicks to pass through to game markers
        }).addTo(appState.map);

        markers.push(marker);
    });

    setRouteState('routeMarkers', markers);

    if (polylineCoords.length > 0) {
        const bounds = L.latLngBounds(polylineCoords);
        appState.map.fitBounds(bounds.pad(0.1));
    }

    updateRouteProgress(state.currentRoute, state.currentStepIndex);
};

export const clearRouteDisplay = () => {
    const state = getRouteState();

    if (state.routePolyline && appState.map) {
        appState.map.removeLayer(state.routePolyline);
        setRouteState('routePolyline', null);
    }

    state.routeMarkers.forEach(marker => {
        if (appState.map) appState.map.removeLayer(marker);
    });
    setRouteState('routeMarkers', []);
};

export const saveRoute = (name) => {
    const state = getRouteState();
    if (!state.currentRoute) return false;

    const savedRoutes = JSON.parse(localStorage.getItem('wwm_saved_routes') || '[]');

    const routeToSave = {
        id: Date.now().toString(),
        name: name || `Route ${savedRoutes.length + 1}`,
        region: state.currentRoute.region,
        categories: state.currentRoute.categories,
        route: state.currentRoute.route.map(p => ({ id: p.id, order: p.order })),
        createdAt: state.currentRoute.createdAt,
        isManual: state.currentRoute.isManual || false
    };

    savedRoutes.push(routeToSave);
    localStorage.setItem('wwm_saved_routes', JSON.stringify(savedRoutes));

    logger.success('RouteMode', `Route saved: ${routeToSave.name}`);
    return true;
};

export const loadRoute = (routeId) => {
    const savedRoutes = JSON.parse(localStorage.getItem('wwm_saved_routes') || '[]');
    const savedRoute = savedRoutes.find(r => r.id === routeId);

    if (!savedRoute) {
        logger.error('RouteMode', 'Route not found');
        return null;
    }

    const items = savedRoute.route.map(saved => {
        const item = appState.mapData.items.find(i => i.id === saved.id);
        return item ? {
            ...item,
            order: saved.order,
            lat: parseFloat(item.x),
            lng: parseFloat(item.y)
        } : null;
    }).filter(Boolean);

    const route = {
        route: items,
        region: savedRoute.region,
        categories: savedRoute.categories,
        totalDistance: 0,
        pointCount: items.length,
        createdAt: savedRoute.createdAt,
        isManual: savedRoute.isManual || false
    };

    setRouteState('currentRoute', route);
    setRouteState('currentStepIndex', 0);

    if (savedRoute.region && savedRoute.region !== 'all' && savedRoute.region !== 'manual') {
        setOnlyRegionActive(savedRoute.region);
    }

    return route;
};

export const getSavedRoutes = () => {
    return JSON.parse(localStorage.getItem('wwm_saved_routes') || '[]');
};

export const deleteRoute = (routeId) => {
    let savedRoutes = JSON.parse(localStorage.getItem('wwm_saved_routes') || '[]');
    savedRoutes = savedRoutes.filter(r => r.id !== routeId);
    localStorage.setItem('wwm_saved_routes', JSON.stringify(savedRoutes));
    return true;
};

export const getAvailableRegions = () => {
    if (!appState.mapData || !appState.mapData.items) return [];

    const regions = new Set();
    appState.mapData.items.forEach(item => {
        const region = item.forceRegion || item.region;
        if (region && !EXCLUDED_REGIONS.includes(region)) {
            regions.add(region);
        }
    });

    return Array.from(regions).sort();
};

export const getRouteStats = (region, categories = []) => {
    if (!appState.mapData || !appState.mapData.items) return { total: 0, completed: 0 };

    const completedIds = new Set(appState.completedList.map(c => c.id));

    let total = 0;
    let completed = 0;

    appState.mapData.items.forEach(item => {
        const itemRegion = item.forceRegion || item.region;
        const matchesRegion = region === 'all' || itemRegion === region;
        const matchesCategory = categories.length === 0 || categories.includes(item.category);

        if (matchesRegion && matchesCategory) {
            total++;
            if (completedIds.has(item.id)) completed++;
        }
    });

    return { total, completed, remaining: total - completed };
};
