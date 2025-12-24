import { logger } from './logger.js';

let taskIdCounter = 0;
const pendingTasks = new Map();

class WorkerManager {
    constructor() {
        this.workers = {};
        this.isSupported = typeof Worker !== 'undefined';
    }

    getWorker(name) {
        if (!this.isSupported) return null;

        if (!this.workers[name]) {
            try {
                const workerPath = `./js/workers/${name}.js`;
                this.workers[name] = new Worker(workerPath);

                this.workers[name].onmessage = (e) => {
                    const { taskId, success, result, error } = e.data;
                    const task = pendingTasks.get(taskId);

                    if (task) {
                        pendingTasks.delete(taskId);
                        if (success) {
                            task.resolve(result);
                        } else {
                            task.reject(new Error(error));
                        }
                    }
                };

                this.workers[name].onerror = (e) => {
                    logger.error('WorkerManager', `Worker ${name} error:`, e);
                };

                logger.success('WorkerManager', `워커 생성: ${name}`);
            } catch (error) {
                logger.warn('WorkerManager', `워커 생성 실패 ${name}:`, error);
                return null;
            }
        }

        return this.workers[name];
    }

    async runTask(workerName, type, payload, timeout = 30000) {
        const worker = this.getWorker(workerName);

        if (!worker) {
            return this.fallbackSync(workerName, type, payload);
        }

        const taskId = ++taskIdCounter;

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                pendingTasks.delete(taskId);
                logger.warn('WorkerManager', `태스크 타임아웃, 동기 폴백: ${type}`);
                resolve(this.fallbackSync(workerName, type, payload));
            }, timeout);

            pendingTasks.set(taskId, {
                resolve: (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    logger.warn('WorkerManager', `태스크 실패: ${type}`, error);
                    resolve(this.fallbackSync(workerName, type, payload));
                }
            });

            worker.postMessage({ type, payload, taskId });
        });
    }

    fallbackSync(workerName, type, payload) {
        logger.log('WorkerManager', `동기 폴백 실행: ${type}`);

        switch (type) {
            case 'PARSE_JSON':
                return JSON.parse(payload.jsonString);

            case 'PROCESS_CSV':
                return this.processCSVSync(payload.csvText);

            case 'FILTER_BY_BOUNDS':
                return this.filterByBoundsSync(payload.items, payload.bounds, payload.padding);

            case 'FILTER_BY_CATEGORY':
                return payload.items.filter(item =>
                    new Set(payload.activeCategoryIds).has(item.category)
                );

            case 'FILTER_BY_REGION':
                return payload.items.filter(item => {
                    const region = item.forceRegion || item.region || "알 수 없음";
                    return new Set(payload.activeRegionNames).has(region);
                });

            case 'SEARCH':
                const term = (payload.searchTerm || '').toLowerCase().trim();
                if (!term) return payload.items;
                return payload.items.filter(item => {
                    const name = (item.name || '').toLowerCase();
                    const desc = (item.description || '').toLowerCase();
                    return name.includes(term) || desc.includes(term);
                });

            default:
                logger.warn('WorkerManager', `폴백 없음: ${type}`);
                return payload.items || payload;
        }
    }

    filterByBoundsSync(items, bounds, padding = 0) {
        const minLat = bounds.south - padding;
        const maxLat = bounds.north + padding;
        const minLng = bounds.west - padding;
        const maxLng = bounds.east + padding;

        return items.filter(item => {
            const lat = parseFloat(item.x);
            const lng = parseFloat(item.y);
            return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
        });
    }

    processCSVSync(csvText) {
        const koDict = {};
        const categoryItemTranslations = {};
        const parsedCSV = [];

        const lines = csvText.split(/\r?\n/);
        if (lines.length === 0) return { koDict, categoryItemTranslations, parsedCSV };

        const headerLine = lines.shift();
        const headers = this.parseCSVLine(headerLine);
        parsedCSV.push(headers);

        const typeIdx = headers.indexOf('Type');
        const catIdx = headers.indexOf('Category');
        const keyIdx = headers.indexOf('Key');
        const valIdx = headers.indexOf('Korean');
        const descIdx = headers.indexOf('Description');

        lines.forEach(line => {
            if (!line.trim()) return;
            const parsed = this.parseCSVLine(line);
            if (!parsed || parsed.length < 3) return;

            parsedCSV.push(parsed);

            const type = parsed[typeIdx]?.trim();
            const key = parsed[keyIdx]?.trim();
            if (!key) return;

            if (type === 'Common') {
                const val = parsed[valIdx];
                if (val) koDict[key] = val;
            }
        });

        return { koDict, categoryItemTranslations, parsedCSV };
    }

    parseCSVLine(str) {
        const arr = [];
        let quote = false;
        let value = '';

        for (let i = 0; i < str.length; i++) {
            const cc = str[i];
            const nc = str[i + 1];

            if (cc === '"' && quote && nc === '"') { value += cc; i++; }
            else if (cc === '"') { quote = !quote; }
            else if (cc === ',' && !quote) { arr.push(value); value = ''; }
            else { value += cc; }
        }
        arr.push(value);
        return arr;
    }

    terminateAll() {
        Object.keys(this.workers).forEach(name => {
            this.workers[name].terminate();
            delete this.workers[name];
        });
        pendingTasks.clear();
        logger.log('WorkerManager', '모든 워커 종료됨');
    }

    async parseJSON(jsonString) {
        return this.runTask('data-worker', 'PARSE_JSON', { jsonString });
    }

    async processCSV(csvText) {
        return this.runTask('data-worker', 'PROCESS_CSV', { csvText });
    }

    async processRegionData(regionJson, koDict) {
        return this.runTask('data-worker', 'PROCESS_REGION_DATA', { regionJson, koDict });
    }

    async processMapData(rawItems, regionIdMap, missingItems, categoryItemTranslations, reverseRegionMap) {
        return this.runTask('data-worker', 'PROCESS_MAP_DATA', {
            rawItems,
            regionIdMap,
            missingItems: Array.from(missingItems),
            categoryItemTranslations,
            reverseRegionMap
        });
    }

    async filterByBounds(items, bounds, padding = 0) {
        return this.runTask('filter-worker', 'FILTER_BY_BOUNDS', { items, bounds, padding });
    }

    async filterByCategory(items, activeCategoryIds) {
        return this.runTask('filter-worker', 'FILTER_BY_CATEGORY', {
            items,
            activeCategoryIds: Array.from(activeCategoryIds)
        });
    }

    async filterByRegion(items, activeRegionNames) {
        return this.runTask('filter-worker', 'FILTER_BY_REGION', {
            items,
            activeRegionNames: Array.from(activeRegionNames)
        });
    }

    async applyAllFilters(items, options) {
        return this.runTask('filter-worker', 'APPLY_ALL_FILTERS', {
            items,
            activeCategoryIds: options.activeCategoryIds ? Array.from(options.activeCategoryIds) : null,
            activeRegionNames: options.activeRegionNames ? Array.from(options.activeRegionNames) : null,
            completedList: options.completedList || [],
            hideCompleted: options.hideCompleted || false,
            bounds: options.bounds || null,
            padding: options.padding || 0,
            searchTerm: options.searchTerm || '',
            koDict: options.koDict || {}
        });
    }

    async search(items, searchTerm, koDict = {}) {
        return this.runTask('filter-worker', 'SEARCH', { items, searchTerm, koDict });
    }

    async buildSpatialIndex(items, cellSize = 0.02) {
        return this.runTask('filter-worker', 'BUILD_SPATIAL_INDEX', { items, cellSize });
    }
}

export const workerManager = new WorkerManager();
