class TaskStrategy {
    execute(payload) {
        throw new Error("Method 'execute' must be implemented.");
    }
}

export class DataParsingStrategy extends TaskStrategy {
    execute(type, payload) {
        switch (type) {
            case 'PARSE_JSON':
                return JSON.parse(payload.jsonString);
            case 'PROCESS_CSV':
                return this.processCSV(payload.csvText);
            default:
                throw new Error(`Unknown data parsing task: ${type}`);
        }
    }

    processCSV(csvText) {
        const koDict = {};
        const categoryItemTranslations = {};
        const parsedCSV = [];

        const lines = csvText.split(/\r?\n/);
        if (lines.length === 0) return { koDict, categoryItemTranslations, parsedCSV };

        const headerLine = lines.shift();
        const headers = this.parseCSVLine(headerLine);
        parsedCSV.push(headers);

        const typeIdx = headers.indexOf('Type');
        const keyIdx = headers.indexOf('Key');
        const valIdx = headers.indexOf('Korean');

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
}

export class FilteringStrategy extends TaskStrategy {
    execute(type, payload) {
        switch (type) {
            case 'FILTER_BY_BOUNDS':
                return this.filterByBounds(payload.items, payload.bounds, payload.padding);
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
                return this.search(payload.items, payload.searchTerm);
            default:
                throw new Error(`Unknown filtering task: ${type}`);
        }
    }

    filterByBounds(items, bounds, padding = 0) {
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

    search(items, searchTerm) {
        const term = (searchTerm || '').toLowerCase().trim();
        if (!term) return items;
        return items.filter(item => {
            const name = (item.name || '').toLowerCase();
            const desc = (item.description || '').toLowerCase();
            return name.includes(term) || desc.includes(term);
        });
    }
}
