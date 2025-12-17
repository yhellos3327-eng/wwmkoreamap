import { state } from './state.js';

export const t = (key) => {
    if (!key) return "";
    const trimmedKey = key.toString().trim();
    return state.koDict[trimmedKey] || key;
};

export const getJosa = (word, type) => {
    if (!word || typeof word !== 'string') return type.split('/')[0];
    const lastChar = word.charCodeAt(word.length - 1);
    if (lastChar < 0xAC00 || lastChar > 0xD7A3) return type.split('/')[0];
    const hasJongsung = (lastChar - 0xAC00) % 28 !== 0;
    const [josa1, josa2] = type.split('/');
    return hasJongsung ? josa1 : josa2;
};

export const isPointInPolygon = (point, vs) => {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const parseCSV = (str) => {
    const arr = [];
    let quote = false;
    let col = 0, c = 0;

    for (let row = 0; row < str.length; row++) {
        let cc = str[row], nc = str[row + 1];
        arr[col] = arr[col] || [];
        arr[col][c] = arr[col][c] || "";

        if (cc == '"' && quote && nc == '"') { arr[col][c] += cc; ++row; }
        else if (cc == '\\' && quote && nc == '"') { arr[col][c] += nc; ++row; }
        else if (cc == '"') { quote = !quote; }
        else if (cc == ',' && !quote) { ++c; }
        else if (cc == '\r' && nc == '\n' && !quote) { ++col; c = 0; ++row; }
        else if ((cc == '\n' || cc == '\r') && !quote) { ++col; c = 0; }
        else { arr[col][c] += cc; }
    }
    return arr;
};

export const fetchWithProgress = async (url, onProgress) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} 로드 실패: ${response.statusText}`);

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;
        if (total && onProgress) {
            onProgress(loaded, total);
        }
    }

    const blob = new Blob(chunks);
    return blob; // Return blob, caller can use .json() or .text()
};

export const fetchAndParseCSVChunks = async (url, onChunk, onComplete, onProgress) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} 로드 실패`);

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let isFirstChunk = true;
    let headers = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        loaded += value.length;
        if (total && onProgress) {
            onProgress(loaded, total);
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();

        if (isFirstChunk) {
            if (lines.length > 0) {
                const headerLine = lines.shift();
                headers = parseCSV(headerLine)[0];
                isFirstChunk = false;
            }
        }

        if (lines.length > 0) {
            const chunkData = lines.map(line => {
                const parsed = parseCSV(line)[0];
                if (!parsed || parsed.length === 0 || (parsed.length === 1 && parsed[0] === "")) return null;
                return parsed;
            }).filter(item => item !== null);

            if (chunkData.length > 0) {
                onChunk(chunkData, headers);
            }
        }
    }
    if (buffer.trim()) {
        const chunkData = [parseCSV(buffer)[0]];
        onChunk(chunkData, headers);
    }

    if (onComplete) onComplete();
};
