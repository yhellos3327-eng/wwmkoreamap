import { logger } from '../logger.js';

let badWordsList = [];

const BADWORDS_SOURCES = [
    { url: 'https://raw.githubusercontent.com/yoonheyjung/badwords-ko/refs/heads/main/src/badwords.ko.config.json', type: 'json', key: 'badWords' },
    { url: 'https://raw.githubusercontent.com/organization/Gentleman/refs/heads/master/resources/badwords.json', type: 'json', key: 'badwords' },
    { url: './js/badwords/fword_list.txt', type: 'text' }
];

export const loadBadWords = async () => {
    const allWords = new Set();

    for (const source of BADWORDS_SOURCES) {
        try {
            const response = await fetch(source.url);

            if (source.type === 'text') {
                const text = await response.text();
                const words = text.split('\n').map(w => w.trim()).filter(w => w);
                words.forEach(word => allWords.add(word.toLowerCase()));
            } else {
                const data = await response.json();
                const words = data[source.key] || [];
                words.forEach(word => allWords.add(word.toLowerCase()));
            }
        } catch (e) {
            logger.warn('BadWords', `소스 로드 실패: ${source.url}`, e.message);
        }
    }

    badWordsList = [...allWords];
    logger.success('BadWords', `${badWordsList.length}개 비속어 로드 완료`);
};

export const containsBadWord = (text) => {
    if (!text || badWordsList.length === 0) return false;
    const lowerText = text.toLowerCase();
    return badWordsList.some(word => lowerText.includes(word));
};

export const getBadWordsCount = () => badWordsList.length;

loadBadWords();
