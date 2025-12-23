import { state } from '../state.js';
import { t } from '../utils.js';
import { saveFilterState } from '../data.js';
import { updateMapVisibility } from './visibility.js';

export const renderRegionPolygons = (filteredRegions) => {
    const regionPolygons = [];

    if (state.regionLayerGroup) {
        state.regionLayerGroup.clearLayers();
    }

    if (filteredRegions && Array.isArray(filteredRegions)) {
        filteredRegions.forEach(region => {
            if (!region.coordinates || region.coordinates.length === 0) return;

            const polygonCoords = region.coordinates.map(coord => [parseFloat(coord[1]), parseFloat(coord[0])]);
            const translatedRegionName = t(region.title);

            regionPolygons.push({
                title: region.title,
                coords: polygonCoords
            });

            const polygon = L.polygon(polygonCoords, {
                color: state.savedRegionColor,
                weight: 1,
                opacity: 1,
                fillColor: state.savedRegionFillColor,
                fillOpacity: 0.1,
                className: 'region-polygon'
            });

            polygon.bindTooltip(translatedRegionName, {
                permanent: true,
                direction: 'center',
                className: 'region-label'
            });

            polygon.on('mouseover', function () {
                this.setStyle({ weight: 2, fillOpacity: 0.4 });
            });

            polygon.on('mouseout', function () {
                this.setStyle({ weight: 1, fillOpacity: 0.1 });
            });

            polygon.on('click', function (e) {
                if (state.isDevMode) return;
                L.DomEvent.stopPropagation(e);
                state.map.fitBounds(this.getBounds());
            });

            polygon.on('contextmenu', function (e) {
                L.DomEvent.preventDefault(e);
                L.DomEvent.stopPropagation(e);

                state.activeRegionNames.clear();
                state.activeRegionNames.add(region.title);

                updateMapVisibility();
                saveFilterState();
            });

            state.regionLayerGroup.addLayer(polygon);
        });
    }

    return regionPolygons;
};
