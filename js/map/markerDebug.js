import { state } from '../state.js';

export const logMarkerDebugInfo = (item, catId, finalRegionName, lat, lng) => {
    const debugInfo = {
        "ID": item.id,
        "Name": item.name,
        "Category (Mapped)": catId,
        "Category (Original)": item.category,
        "Region": finalRegionName,
        "Coordinates": `${lat}, ${lng}`
    };

    console.groupCollapsed(`%c📍 [${item.id}] ${item.name}`, "font-size: 14px; font-weight: bold; color: #ffbd53; background: #222; padding: 4px 8px; border-radius: 4px;");
    console.table(debugInfo);

    if (state.rawCSV && state.parsedCSV && state.parsedCSV.length > 0) {
        console.groupCollapsed("%c📄 CSV Source Data Available", "font-weight: bold; color: #4CAF50;");
        const headers = state.parsedCSV[0].map(h => h.trim());
        const keyIdx = headers.indexOf('Key');
        let rowIndex = keyIdx !== -1 ? state.parsedCSV.findIndex(r => r[keyIdx] == item.id) : -1;

        if (rowIndex === -1 && keyIdx !== -1) {
            rowIndex = state.parsedCSV.findIndex(r => r[keyIdx] === item.name || r[keyIdx] === item.name?.trim());
        }

        if (rowIndex !== -1) {
            const row = state.parsedCSV[rowIndex];
            const rawLines = state.rawCSV.split(/\r?\n/);
            const rawLine = rawLines[rowIndex];

            console.log("%cFound Row in CSV", "font-size: 16px; font-weight: bold; color: #2196F3;");
            headers.forEach((h, i) => {
                console.log(`%c${h.padEnd(12)}%c${row[i]}`, "color: #aaa;", "color: #fff;");
            });

            if (rawLine) {
                console.log("%cRaw CSV Line", "font-weight: bold; color: #FF5722;");
                console.log(rawLine);
            }
        }
        console.groupEnd();
    }
    console.groupEnd();
};
