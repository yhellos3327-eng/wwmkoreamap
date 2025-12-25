import { logger } from '../logger.js';
import { renderFromWorker } from './canvas.js';

class MapWorkerManager {
    constructor() {
        this.worker = null;
        this.isReady = false;
    }

    init() {
        if (this.worker) return;

        this.worker = new Worker('js/map/map.worker.js');

        this.worker.onmessage = (e) => {
            const { type, payload } = e.data;

            switch (type) {
                case 'INIT_COMPLETE':
                    this.isReady = true;
                    logger.success('Worker', `워커 초기화 완료 (아이템 ${payload.count}개)`);
                    break;

                case 'RENDER_UPDATE':
                    renderFromWorker(payload.toAdd, payload.toRemove);
                    break;
            }
        };

        this.worker.onerror = (e) => {
            logger.error('Worker', `워커 에러 발생: ${e.message} (${e.filename}:${e.lineno})`);
        };

        logger.log('Worker', 'Web Worker 시작됨');
    }

    initData(items) {
        if (!this.worker) this.init();
        this.worker.postMessage({
            type: 'INIT_DATA',
            payload: { items }
        });
    }

    updateFilters(filters) {
        if (!this.worker) return;
        // filters: { activeCategories, activeRegionNames, completedList, hideCompleted }
        const payload = {};
        if (filters.activeCategories) payload.activeCategories = Array.from(filters.activeCategories);
        if (filters.activeRegionNames) payload.activeRegionNames = Array.from(filters.activeRegionNames);
        if (filters.completedList) payload.completedList = Array.from(filters.completedList);
        if (typeof filters.hideCompleted !== 'undefined') payload.hideCompleted = filters.hideCompleted;

        this.worker.postMessage({
            type: 'UPDATE_FILTERS',
            payload
        });
    }

    updateViewport(bounds, padding = 0) {
        if (!this.worker || !this.isReady) return;
        const plainBounds = {
            south: bounds.getSouth(),
            west: bounds.getWest(),
            north: bounds.getNorth(),
            east: bounds.getEast()
        };

        this.worker.postMessage({
            type: 'UPDATE_VIEWPORT',
            payload: {
                bounds: plainBounds,
                padding
            }
        });
    }
}

export const workerManager = new MapWorkerManager();
