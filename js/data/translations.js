import { state, setState } from '../state.js';
import { fetchAndParseCSVChunks } from '../utils.js';

export const loadTranslations = async (mapKey) => {
    state.koDict = {};
    state.categoryItemTranslations = {};
    state.parsedCSV = [];

    const processCSVChunk = (chunkData, headers) => {
        if (!headers) return;

        if (state.parsedCSV.length === 0) {
            state.parsedCSV.push(headers);
        }
        state.parsedCSV.push(...chunkData);

        const typeIdx = headers.indexOf('Type');
        const catIdx = headers.indexOf('Category');
        const keyIdx = headers.indexOf('Key');
        const valIdx = headers.indexOf('Korean');
        const descIdx = headers.indexOf('Description');
        const regIdx = headers.indexOf('Region');
        const imgIdx = headers.indexOf('Image');
        const videoIdx = headers.indexOf('Video');
        const posIdx = headers.indexOf('CustomPosition');

        chunkData.forEach(row => {
            if (row.length < 3) return;

            const type = row[typeIdx]?.trim();
            const key = row[keyIdx]?.trim();
            if (!key) return;

            if (type === 'Common') {
                const val = row[valIdx];
                if (val) {
                    state.koDict[key] = val;
                    state.koDict[key.trim()] = val;
                }
            } else if (type === 'Override') {
                processOverrideRow(row, catIdx, keyIdx, valIdx, descIdx, regIdx, imgIdx, videoIdx, posIdx);
            }
        });
    };

    await fetchAndParseCSVChunks('./translation.csv', processCSVChunk);

    if (mapKey === 'kaifeng') {
        try {
            await fetchAndParseCSVChunks('./translation2.csv', processCSVChunk);
            console.log("Loaded translation2.csv for Kaifeng");
        } catch (e) {
            console.warn("translation2.csv not found or failed to load", e);
        }
    }
};

const processOverrideRow = (row, catIdx, keyIdx, valIdx, descIdx, regIdx, imgIdx, videoIdx, posIdx) => {
    const catId = row[catIdx]?.trim();
    const key = row[keyIdx]?.trim();
    if (!catId || !key) return;

    if (!state.categoryItemTranslations[catId]) {
        state.categoryItemTranslations[catId] = {};
    }

    if (key === '_common_description') {
        state.categoryItemTranslations[catId]._common_description = row[descIdx];
        return;
    }

    let desc = row[descIdx];
    if (desc) {
        desc = desc.replace(/<hr>/g, '<hr style="border: 0; border-bottom: 1px solid var(--border); margin: 10px 0;">');
    }

    const imageData = parseImageField(row[imgIdx], key);
    const videoData = parseVideoField(row[videoIdx]);
    const customPosition = parseCustomPosition(row[posIdx]);

    state.categoryItemTranslations[catId][key] = {
        name: row[valIdx],
        description: desc,
        region: row[regIdx],
        image: imageData,
        video: videoData,
        customPosition: customPosition
    };
};

const parseImageField = (imageRaw, key) => {
    if (!imageRaw) return null;

    const trimmed = imageRaw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const content = trimmed.slice(1, -1);
        return content.split('|').map(v => {
            let path = v.trim();
            if (path.includes('{id}')) {
                path = path.replace('{id}', key);
            }
            return path;
        }).filter(v => v !== "");
    } else {
        let path = trimmed;
        if (path.includes('{id}')) {
            path = path.replace('{id}', key);
        }
        return path;
    }
};

const parseVideoField = (videoUrl) => {
    if (!videoUrl) return null;

    const trimmed = videoUrl.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const content = trimmed.slice(1, -1);
        return content.split('|').map(v => v.trim()).filter(v => v !== "");
    } else {
        return trimmed;
    }
};

// Parse CustomPosition in [x|y] format
const parseCustomPosition = (positionRaw) => {
    if (!positionRaw) return null;

    const trimmed = positionRaw.trim();
    // Format: [x|y] e.g. [1.283662|-1.102238]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const content = trimmed.slice(1, -1);
        const parts = content.split('|');
        if (parts.length === 2) {
            const x = parseFloat(parts[0].trim());
            const y = parseFloat(parts[1].trim());
            if (!isNaN(x) && !isNaN(y)) {
                return { x, y };
            }
        }
    }
    return null;
};
