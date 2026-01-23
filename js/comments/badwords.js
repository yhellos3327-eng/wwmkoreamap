// @ts-check
import { logger } from "../logger.js";

/** @type {string[]} */
let badWordsList = [];
/** @type {string[]} */
let spamKeywordsList = [];

/**
 * @typedef {Object} BadWordsSource
 * @property {string} url - The URL to fetch bad words from.
 * @property {string} type - The type of data ('json' or 'text').
 * @property {string} [key] - The key to access bad words in JSON.
 * @property {boolean} [isSpam] - Whether this source contains spam keywords.
 * @property {boolean} [encrypted] - Whether the source is encrypted.
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
  {
    url: "./js/badwords/spam_keywords.json",
    type: "json",
    key: "spamKeywords",
    isSpam: true,
    encrypted: true,
  },
];

/**
 * Decrypts the encrypted data.
 * @param {string} encoded - The Base64 encoded string.
 * @returns {string} The decrypted string.
 */
const decrypt = (encoded) => {
  const key = "wwm_secure_key";
  const decoded = atob(encoded);
  let result = "";
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return decodeURIComponent(escape(result));
};

/**
 * Loads bad words from all configured sources.
 * @returns {Promise<void>}
 */
export const loadBadWords = async () => {
  const allBadWords = new Set();
  const allSpamKeywords = new Set();

  for (const source of BADWORDS_SOURCES) {
    try {
      const response = await fetch(source.url);

      if (source.type === "text") {
        const text = await response.text();
        const words = text
          .split("\n")
          .map((w) => w.trim())
          .filter((w) => w);
        words.forEach((word) => allBadWords.add(word.toLowerCase()));
      } else {
        const data = await response.json();
        let words = [];

        if (source.encrypted && data.data) {
          try {
            const decryptedJson = decrypt(data.data);
            const parsed = JSON.parse(decryptedJson);
            words = parsed[source.key] || [];
          } catch (e) {
            console.error("Decryption failed for", source.url, e);
          }
        } else {
          words = data[source.key] || [];
        }

        if (source.isSpam) {
          words.forEach((word) => allSpamKeywords.add(word.toLowerCase()));
        } else {
          words.forEach((word) => allBadWords.add(word.toLowerCase()));
        }
      }
    } catch (e) {
      logger.warn("BadWords", `소스 로드 실패: ${source.url}`, e.message);
    }
  }

  badWordsList = [...allBadWords];
  spamKeywordsList = [...allSpamKeywords];
  logger.success("BadWords", `${badWordsList.length}개 비속어, ${spamKeywordsList.length}개 스팸 키워드 로드 완료`);
};

/**
 * Checks if text contains any bad words or spam keywords.
 * Normalizes text by removing spaces and special characters before checking.
 * @param {string} text - The text to check.
 * @returns {boolean} True if bad word is found.
 */
export const containsBadWord = (text) => {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  // Normalize: remove spaces, special chars, numbers (keep only hangul/english)
  const normalizedText = lowerText.replace(/[^가-힣a-z]/g, "");

  // Check spam keywords first (against normalized text)
  if (spamKeywordsList.some((word) => {
    // Normalize keyword too just in case
    const normalizedKeyword = word.toLowerCase().replace(/[^가-힣a-z]/g, "");
    return normalizedText.includes(normalizedKeyword);
  })) {
    return true;
  }

  if (badWordsList.length === 0) return false;

  // Check regular bad words (original logic + normalized check)
  return badWordsList.some((word) => {
    if (lowerText.includes(word)) return true;
    return false;
  });
};

/**
 * Gets the count of loaded bad words.
 * @returns {number} The count of bad words.
 */
export const getBadWordsCount = () => badWordsList.length;

loadBadWords();
