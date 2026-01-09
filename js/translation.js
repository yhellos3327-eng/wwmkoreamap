import { state } from './state.js';
import { t } from './utils.js';

/**
 * Chrome 내장 번역 사용하여 아이템 번역
 */
const translateWithChromeBuiltin = async (item, btn) => {
    try {
        const { translateGameItem, isChromeBuiltinTranslationSupported } = await import('./chromeTranslator.js');

        if (!isChromeBuiltinTranslationSupported()) {
            throw new Error('Chrome 내장 번역이 지원되지 않습니다. Chrome 138 이상이 필요합니다.');
        }

        // 진행률 표시
        const onProgress = (loaded, total) => {
            if (btn) {
                const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
                btn.textContent = `모델 다운로드 중... ${percent}%`;
            }
        };

        const result = await translateGameItem(item, onProgress);
        return result;
    } catch (error) {
        console.error('Chrome 내장 번역 실패:', error);
        throw error;
    }
};

/**
 * 외부 AI API를 사용하여 아이템 번역
 */
const translateWithExternalAI = async (item, btn) => {
    const provider = state.savedAIProvider || 'gemini';
    const model = state.savedApiModel || 'gemini-1.5-flash';

    let key = '';
    if (provider === 'gemini') {
        key = state.savedGeminiKey || state.savedApiKey;
    } else if (provider === 'openai') {
        key = state.savedOpenAIKey;
    } else if (provider === 'claude') {
        key = state.savedClaudeKey;
    }

    if (!key) {
        throw new Error("설정(⚙️) 메뉴에서 API Key를 먼저 등록해주세요.");
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

    let result = null;

    if (provider === 'gemini') {
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

    return result;
};

/**
 * 아이템 번역
 * @param {number|string} itemId - 아이템 ID
 * @param {string} translateType - 번역 타입: 'chrome' 또는 'ai'
 */
export const translateItem = async (itemId, translateType = 'ai') => {
    const item = state.mapData.items.find(i => i.id === itemId);
    if (!item) return;

    const popupContainer = document.querySelector(`.popup-container[data-id="${itemId}"]`);
    const btn = popupContainer?.querySelector(translateType === 'chrome' ? '.btn-translate-chrome' : '.btn-translate-ai');
    const allBtns = popupContainer?.querySelectorAll('.btn-translate');

    // 버튼 텍스트 업데이트 헬퍼 함수 (아이콘 유지)
    const updateBtnText = (button, text) => {
        if (!button) return;
        const textSpan = button.querySelector('.btn-text');
        if (textSpan) {
            textSpan.textContent = text;
        }
    };

    // 모든 버튼 비활성화
    if (allBtns) {
        allBtns.forEach(b => {
            b.disabled = true;
            b.style.opacity = '0.6';
        });
    }

    if (btn) {
        updateBtnText(btn, "번역 중...");
    }

    try {
        let result;

        if (translateType === 'chrome') {
            result = await translateWithChromeBuiltin(item, btn);
        } else {
            // 외부 AI API 사용 - API 키 확인
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
                if (allBtns) {
                    allBtns.forEach(b => {
                        b.disabled = false;
                        b.style.opacity = '1';
                    });
                }
                updateBtnText(btn, "AI");
                return;
            }

            result = await translateWithExternalAI(item, btn);
        }

        // 아이템 데이터 업데이트
        item.name = result.name;
        item.description = result.description;
        item.isTranslated = true;

        // 팝업 내용 직접 업데이트 (팝업을 닫지 않고 내용만 갱신하여 이정표 유지)
        if (popupContainer) {
            // 제목 업데이트
            const titleEl = popupContainer.querySelector('.popup-header h4');
            if (titleEl) {
                titleEl.textContent = t(result.name) || result.name;
            }

            // 본문 업데이트
            const bodyEl = popupContainer.querySelector('.popup-body p');
            if (bodyEl) {
                let desc = result.description || '';
                desc = desc.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--accent); text-decoration: underline;">$1</a>');
                desc = desc.replace(/\n/g, '<br>');
                desc = desc.replace(/{spoiler}([\s\S]*?){\/spoiler}/g, '<span class="spoiler" data-action="reveal-spoiler">$1</span>');
                bodyEl.innerHTML = desc;
            }

            // 번역 버튼 영역 숨기기
            const translateBtnsContainer = popupContainer.querySelector('.translate-buttons');
            if (translateBtnsContainer) {
                translateBtnsContainer.style.display = 'none';
            }
        }

    } catch (error) {
        console.error("Translation failed:", error);

        // 에러 메시지
        if (translateType === 'chrome') {
            alert(`Chrome 내장 번역 실패: ${error.message}\n\n가능한 원인:\n- Chrome 138 미만 버전 사용\n- 번역 모델 미다운로드\n- GenAILocalFoundationalModelSettings 정책에 의해 차단됨`);
        } else {
            alert("번역 실패: " + error.message);
        }

        // 버튼 복구
        if (allBtns) {
            allBtns.forEach(b => {
                b.disabled = false;
                b.style.opacity = '1';
            });
        }
        updateBtnText(btn, translateType === 'chrome' ? "내장" : "AI");
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
