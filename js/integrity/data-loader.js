let cachedData = null;

const parseCSVLine = (line) => {
    const parts = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            parts.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    parts.push(current.trim().replace(/^"|"$/g, ''));

    return parts;
};

export const loadAllData = async (options = {}) => {
    if (cachedData && !options.force) {
        return cachedData;
    }

    const allMarkerIds = new Set();
    const allRegionNames = new Set();

    const log = options.onLog || (() => { });

    log('> 전체 데이터 파일 로드 중...', 'info');

    try {
        await loadJSONMarkers(allMarkerIds, log);
        await loadCSVMarkers(allMarkerIds, allRegionNames, log);
        await loadRegionJSON(allRegionNames, log);
        await loadTranslationCSV(allRegionNames, log);

        allRegionNames.add('알 수 없음');

        log(`> 데이터 로드 완료: 마커 ${allMarkerIds.size}개, 지역 ${allRegionNames.size}개`, 'success');

        cachedData = { allMarkerIds, allRegionNames };
        return cachedData;

    } catch (error) {
        console.error('Error loading data:', error);
        return { allMarkerIds: new Set(), allRegionNames: new Set() };
    }
};

const loadJSONMarkers = async (markerIds, log) => {
    const files = ['./data.json', './data2.json'];

    for (const file of files) {
        try {
            const res = await fetch(file);
            if (!res.ok) continue;

            const json = await res.json();
            let count = 0;

            if (json.data && Array.isArray(json.data)) {
                json.data.forEach(item => {
                    if (item.id) {
                        markerIds.add(String(item.id));
                        count++;
                    }
                });
            }

            log(`  - ${file}: 마커 ${count}개 로드`, 'info');
        } catch (e) {
            console.warn(`Failed to load ${file}:`, e);
        }
    }
};

const loadCSVMarkers = async (markerIds, regionNames, log) => {
    const files = ['./data3.csv', './data4.csv'];

    for (const file of files) {
        try {
            const res = await fetch(file);
            if (!res.ok) continue;

            const text = await res.text();
            const lines = text.split('\n');
            let markerCount = 0;
            let regionCount = 0;

            const headers = lines[0] ? lines[0].split(',').map(h => h.trim().toLowerCase()) : [];
            const regionIdIndex = headers.findIndex(h => h === 'regionid');

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const parts = line.split(',');
                if (parts.length > 0 && parts[0]) {
                    const id = parts[0].trim();
                    if (/^\d+$/.test(id)) {
                        markerIds.add(id);
                        markerCount++;
                    }

                    if (regionIdIndex !== -1 && parts[regionIdIndex]) {
                        const regionName = parts[regionIdIndex].trim();
                        if (regionName && !regionNames.has(regionName)) {
                            regionNames.add(regionName);
                            regionCount++;
                        }
                    }
                }
            }

            log(`  - ${file}: 마커 ${markerCount}개, 지역 ${regionCount}개 로드`, 'info');
        } catch (e) {
            console.warn(`Failed to load ${file}:`, e);
        }
    }
};

const loadRegionJSON = async (regionNames, log) => {
    const files = ['./regions.json', './regions2.json'];

    for (const file of files) {
        try {
            const res = await fetch(file);
            if (!res.ok) continue;

            const json = await res.json();
            let count = 0;

            if (json.data && Array.isArray(json.data)) {
                json.data.forEach(item => {
                    if (item.title) {
                        regionNames.add(item.title);
                        count++;
                    }
                });
            }

            log(`  - ${file}: 지역 ${count}개 로드`, 'info');
        } catch (e) {
            console.warn(`Failed to load ${file}:`, e);
        }
    }
};

const loadTranslationCSV = async (regionNames, log) => {
    const files = ['./translation.csv', './translation2.csv'];

    for (const file of files) {
        try {
            const res = await fetch(file);
            if (!res.ok) continue;

            const text = await res.text();
            const lines = text.split('\n');
            let regionCount = 0;

            const headerLine = lines[0] || '';
            const headers = parseCSVLine(headerLine).map(h => h.toLowerCase());

            const koreanIndex = headers.findIndex(h => h === 'korean');
            const keyIndex = headers.findIndex(h => h === 'key');
            const regionIndex = headers.findIndex(h => h === 'region');
            const typeIndex = headers.findIndex(h => h === 'type');

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const parts = parseCSVLine(line);

                const type = typeIndex !== -1 ? parts[typeIndex] : '';
                const key = keyIndex !== -1 ? parts[keyIndex] : '';
                const korean = koreanIndex !== -1 ? parts[koreanIndex] : '';
                const region = regionIndex !== -1 ? parts[regionIndex] : '';

                if (type === 'Common') {
                    if (key && !regionNames.has(key)) {
                        regionNames.add(key);
                        regionCount++;
                    }
                    if (korean && !regionNames.has(korean)) {
                        regionNames.add(korean);
                        regionCount++;
                    }
                }

                if (region && !regionNames.has(region)) {
                    regionNames.add(region);
                    regionCount++;
                }
            }

            if (regionCount > 0) {
                log(`  - ${file}: 번역 지역 ${regionCount}개 로드`, 'info');
            }
        } catch (e) {
            console.warn(`Failed to load translation ${file}:`, e);
        }
    }
};

export const clearDataCache = () => {
    cachedData = null;
};

export const getCachedData = () => cachedData;
