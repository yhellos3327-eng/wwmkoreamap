// @ts-check
import { logger } from "../logger.js";

/** @type {string[]} */
let badWordsList = [];

/**
 * @typedef {Object} BadWordsSource
 * @property {string} url - The URL to fetch bad words from.
 * @property {string} type - The type of data ('json' or 'text').
 * @property {string} [key] - The key to access bad words in JSON.
 */

/** @type {BadWordsSource[]} */
const BADWORDS_SOURCES = [
  {
    url: "https://raw.githubusercontent.com/yoonheyjung/badwords-ko/refs/heads/main/src/badwords.ko.config.json",
    type: "json",
    key: "badWords",
  },
  {
    url: "https://raw.githubusercontent.com/organization/Gentleman/refs/heads/master/resources/badwords.json",
    type: "json",
    key: "badwords",
  },
  { url: "./js/badwords/fword_list.txt", type: "text" },
];

/**
 * Loads bad words from all configured sources.
 * @returns {Promise<void>}
 */
export const loadBadWords = async () => {
  const allWords = new Set();

  for (const source of BADWORDS_SOURCES) {
    try {
      const response = await fetch(source.url);

      if (source.type === "text") {
        const text = await response.text();
        const words = text
          .split("\n")
          .map((w) => w.trim())
          .filter((w) => w);
        words.forEach((word) => allWords.add(word.toLowerCase()));
      } else {
        const data = await response.json();
        const words = data[source.key] || [];
        words.forEach((word) => allWords.add(word.toLowerCase()));
      }
    } catch (e) {
      logger.warn("BadWords", `소스 로드 실패: ${source.url}`, e.message);
    }
  }

  badWordsList = [...allWords];
  logger.success("BadWords", `${badWordsList.length}개 비속어 로드 완료`);
};

/**
 * Checks if text contains any bad words.
 * @param {string} text - The text to check.
 * @returns {boolean} True if bad word is found.
 */
export const containsBadWord = (text) => {
  if (!text || badWordsList.length === 0) return false;
  const lowerText = text.toLowerCase();
  return badWordsList.some((word) => lowerText.includes(word));
};

/**
 * Gets the count of loaded bad words.
 * @returns {number} The count of bad words.
 */
export const getBadWordsCount = () => badWordsList.length;

loadBadWords();
