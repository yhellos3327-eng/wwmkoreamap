import { state } from '../state.js';

export class SpatialIndex {
    constructor(cellSize = 0.05) {
        this.cellSize = cellSize;
        this.grid = new Map();
        this.itemIndex = new Map();
    }

    getCellKey(lat, lng) {
        const cellX = Math.floor(lng / this.cellSize);
        const cellY = Math.floor(lat / this.cellSize);
        return `${cellX},${cellY}`;
    }

    add(item) {
        const lat = parseFloat(item.x);
        const lng = parseFloat(item.y);
        if (isNaN(lat) || isNaN(lng)) return;

        const key = this.getCellKey(lat, lng);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key).push(item);
        this.itemIndex.set(item.id, { item, cellKey: key });
    }

    buildIndex(items) {
        this.clear();
        items.forEach(item => this.add(item));
    }

    clear() {
        this.grid.clear();
        this.itemIndex.clear();
    }

    getCellsInBounds(bounds, padding = 0) {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        const minCellX = Math.floor((sw.lng - padding) / this.cellSize);
        const maxCellX = Math.floor((ne.lng + padding) / this.cellSize);
        const minCellY = Math.floor((sw.lat - padding) / this.cellSize);
        const maxCellY = Math.floor((ne.lat + padding) / this.cellSize);

        const cells = [];
        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                cells.push(`${x},${y}`);
            }
        }
        return cells;
    }

    getItemsInBounds(bounds, padding = 0) {
        const cells = this.getCellsInBounds(bounds, padding);
        const items = [];

        cells.forEach(cellKey => {
            const cellItems = this.grid.get(cellKey);
            if (cellItems) {
                cellItems.forEach(item => {
                    const lat = parseFloat(item.x);
                    const lng = parseFloat(item.y);
                    const paddedBounds = bounds.pad(padding);
                    if (paddedBounds.contains([lat, lng])) {
                        items.push(item);
                    }
                });
            }
        });

        return items;
    }

    getStats() {
        let totalItems = 0;
        let cellCount = 0;
        this.grid.forEach(items => {
            totalItems += items.length;
            cellCount++;
        });
        return {
            cellCount,
            totalItems,
            averageItemsPerCell: cellCount > 0 ? (totalItems / cellCount).toFixed(2) : 0
        };
    }
}

export const spatialIndex = new SpatialIndex(0.02);
