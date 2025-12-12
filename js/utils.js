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
