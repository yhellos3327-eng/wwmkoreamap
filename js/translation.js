import { state } from './state.js';
import { createPopupHtml } from './map.js';

export const translateItem = async (itemId) => {
    if (!state.savedApiKey) {
        alert("설정(⚙️) 메뉴에서 API Key를 먼저 등록해주세요.");
        return;
    }

    const item = state.mapData.items.find(i => i.id === itemId);
    if (!item) return;

    const btn = document.querySelector(`.popup-container[data-id="${itemId}"] .btn-translate`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = "번역 중...";
    }

    const categoryTrans = state.categoryItemTranslations[item.category] || {};

    const prompt = `
    You are translating game data for "Where Winds Meet" (연운) from Chinese/English to Korean.
    
    [Context Info]
    1. The source data was migrated from an English map to a Chinese map, so some records might be in English or contain English references.
    2. Reference the provided "Translation Dictionary" (translation.json data) below.
    3. Important: When translating the Name, look for the most relevant or identical term in the dictionary. If found, use that specific Korean translation to maintain consistency.
    4. Requirement: Translate the ENTIRE Chinese content in the Name and Description fields. Do not leave any Chinese text untranslated.
    
    [Translation Dictionary - Category Specific]
    ${JSON.stringify(categoryTrans)}
    
    [Translation Dictionary - Common Terms (Partial)]
    ${JSON.stringify(state.koDict).substring(0, 1000)} ... (truncated for brevity, prioritize Category Specific)

    [Target Item]
    Name: ${item.name}
    Description: ${item.description}
    
    [Output Format]
    Provide the response in JSON format only: {"name": "Korean Name", "description": "Korean Description"}
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.savedApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const text = data.candidates[0].content.parts[0].text;
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const result = JSON.parse(jsonStr);

        item.name = result.name;
        item.description = result.description;
        item.isTranslated = true;

        const markerObj = state.allMarkers.find(m => m.id === itemId);
        if (markerObj) {
            markerObj.marker.closePopup();
            markerObj.marker.bindPopup(() => createPopupHtml(item, markerObj.marker.getLatLng().lat, markerObj.marker.getLatLng().lng, item.region));
            markerObj.marker.openPopup();
        }

    } catch (error) {
        console.error("Translation failed:", error);
        alert("번역 실패: " + error.message);
        if (btn) {
            btn.disabled = false;
            btn.textContent = "✨ AI 번역 재시도";
        }
    }
};

export const calculateTranslationProgress = () => {
    const totalItems = state.mapData.items.length;
    if (totalItems === 0) return;

    let translatedCount = 0;
    state.mapData.items.forEach(item => {
        if (item.isTranslated || state.koDict[item.name] || state.koDict[item.name.trim()]) {
            translatedCount++;
        }
    });

    const percent = Math.round((translatedCount / totalItems) * 100);

    const bar = document.getElementById('trans-bar');
    const percentText = document.getElementById('trans-percent');
    const statsText = document.getElementById('trans-stats');

    if (bar) bar.style.width = `${percent}%`;
    if (percentText) percentText.textContent = `${percent}%`;
    if (statsText) statsText.textContent = `${translatedCount} / ${totalItems} 항목 번역됨`;
};
