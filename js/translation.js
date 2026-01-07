import { state } from './state.js';
import { createPopupHtml } from './map.js';

export const translateItem = async (itemId) => {
    const provider = state.savedAIProvider || 'gemini';
    let key = '';

    if (provider === 'gemini') {
        key = state.savedGeminiKey;
    } else if (provider === 'openai') {
        key = state.savedOpenAIKey;
    } else if (provider === 'claude') {
        key = state.savedClaudeKey;
    }

    if (!key) {
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
        const provider = state.savedAIProvider || 'gemini';
        const model = state.savedApiModel || 'gemini-1.5-flash';
        let result = null;

        if (provider === 'gemini') {
            const key = state.savedGeminiKey || state.savedApiKey;
            if (!key) throw new Error("Google Gemini API Key가 설정되지 않았습니다.");

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            const text = data.candidates[0].content.parts[0].text;
            result = JSON.parse(text.replace(/```json|```/g, '').trim());

        } else if (provider === 'openai') {
            const key = state.savedOpenAIKey;
            if (!key) throw new Error("OpenAI API Key가 설정되지 않았습니다.");

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "You are a helpful assistant that outputs JSON only." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            result = JSON.parse(data.choices[0].message.content);

        } else if (provider === 'claude') {
            const key = state.savedClaudeKey;
            if (!key) throw new Error("Anthropic API Key가 설정되지 않았습니다.");

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 1024,
                    messages: [{ role: "user", content: prompt }]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            const text = data.content[0].text;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : text;
            result = JSON.parse(jsonStr);
        }

        item.name = result.name;
        item.description = result.description;
        item.isTranslated = true;

        const markerObj = state.allMarkers.get(itemId);
        if (markerObj) {
            if (state.gpuRenderMode && markerObj.sprite) {
                // GPU Mode: Close existing map popup if it matches this itemId
                if (state.map) {
                    state.map.closePopup();
                }

                // Re-open popup with updated content
                const popupContent = createPopupHtml(item, markerObj.lat, markerObj.lng, item.region);
                const popup = L.popup({ offset: L.point(0, 0) })
                    .setLatLng([markerObj.lat, markerObj.lng])
                    .setContent(popupContent);
                popup.itemId = itemId;
                popup.openOn(state.map);

                // Load comments/milestones
                import('./comments.js').then(module => {
                    if (module.loadComments) module.loadComments(itemId);
                });
                import('./votes.js').then(module => {
                    if (module.fetchVoteCounts) module.fetchVoteCounts(itemId);
                });
            } else if (markerObj.marker) {
                // CPU Mode: Standard Leaflet marker
                markerObj.marker.closePopup();
                markerObj.marker.bindPopup(() => createPopupHtml(item, markerObj.marker.getLatLng().lat, markerObj.marker.getLatLng().lng, item.region));
                markerObj.marker.openPopup();
                import('./votes.js').then(module => {
                    if (module.fetchVoteCounts) module.fetchVoteCounts(itemId);
                });
            }
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
