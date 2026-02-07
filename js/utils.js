// @ts-check
/// <reference path="./types.d.ts" />
import { state } from "./state.js";
import Papa from "https://esm.run/papaparse@5.4.1";
import { josa } from "https://esm.run/es-hangul@2.3.0";
import pointInPolygon from "https://esm.run/point-in-polygon@1.1.0";
import { debounce } from "https://esm.run/lodash-es@4.17.22";
import axios from "https://esm.run/axios@1.12.0";
import { marked } from "https://esm.run/marked@12.0.0";

/**
 * Translates a key using the Korean dictionary in the state.
 * @param {string|number} key - The key to translate.
 * @returns {string|number} The translated string or the original key.
 */
export const t = (key) => {
  if (!key) return "";
  const trimmedKey = key.toString().trim();
  return state.koDict[trimmedKey] || key;
};

/**
 * Gets the correct Korean particle (josa) for a word.
 * @param {string} word - The word to attach the particle to.
 * @param {string} type - The type of particle (e.g., '이/가', '을/를').
 * @returns {string} The particle.
 */
export const getJosa = (word, type) => {
  if (!word || typeof word !== "string") return type.split("/")[0];
  // es-hangul returns "word+particle", so we slice off the word to get just the particle
  // to maintain backward compatibility with the existing getJosa signature
  const full = josa(word, type);
  return full.slice(word.length);
};

/**
 * Checks if a point is inside a polygon.
 * @param {number[]} point - The point coordinates [x, y].
 * @param {number[][]} vs - The polygon vertices [[x, y], ...].
 * @returns {boolean} True if the point is inside the polygon.
 */
export const isPointInPolygon = (point, vs) => {
  return pointInPolygon(point, vs);
};

/**
 * Parses a CSV string into an array of arrays.
 * @param {string} str - The CSV string.
 * @returns {string[][]} The parsed data.
 */
export const parseCSV = (str) => {
  const results = Papa.parse(str, {
    header: false,
    skipEmptyLines: false,
  });
  return results.data;
};

/**
 * Fetches a URL with progress tracking.
 * @param {string} url - The URL to fetch.
 * @param {function(number, number): void} [onProgress] - Callback for progress updates (loaded, total).
 * @returns {Promise<Blob>} The response data as a Blob.
 */
export const fetchWithProgress = async (url, onProgress) => {
  try {
    const response = await axios.get(url, {
      responseType: "blob",
      onDownloadProgress: (progressEvent) => {
        if (onProgress) {
          onProgress(progressEvent.loaded, progressEvent.total || 0);
        }
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`${url} 로드 실패: ${error.message}`);
  }
};

/**
 * Fetches and parses a CSV file in chunks.
 * @param {string} url - The URL of the CSV file.
 * @param {function(string[][], string[]|null): void} onChunk - Callback for each chunk of data.
 * @param {function(): void} [onComplete] - Callback when parsing is complete.
 * @param {function(number, number): void} [onProgress] - Callback for download progress.
 * @returns {Promise<void>}
 */
export const fetchAndParseCSVChunks = async (
  url,
  onChunk,
  onComplete,
  onProgress,
) => {
  const blob = await fetchWithProgress(url, onProgress);

  let text = await blob.text();

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  const lines = text.split(/\r?\n/);
  let headers = null;

  if (lines.length > 0) {
    const headerLine = lines.shift();
    headers = parseCSV(headerLine)[0];
  }

  const CHUNK_SIZE = 500;
  for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
    const chunkLines = lines.slice(i, i + CHUNK_SIZE);
    const chunkData = chunkLines
      .map((line) => {
        const parsed = parseCSV(line)[0];
        if (
          !parsed ||
          parsed.length === 0 ||
          (parsed.length === 1 && parsed[0] === "")
        )
          return null;
        return parsed;
      })
      .filter((item) => item !== null);

    if (chunkData.length > 0) {
      onChunk(chunkData, headers);
    }
    if (i + CHUNK_SIZE < lines.length)
      await new Promise((r) => setTimeout(r, 0));
  }

  if (onComplete) onComplete();
};

let cachedIp = null;
let cachedMaskedIp = null;

/**
 * Fetches the user's IP address.
 * @param {boolean} [masked=true] - Whether to return a masked IP.
 * @returns {Promise<string>} The user's IP address.
 */
export const fetchUserIp = async (masked = true) => {
  if (masked && cachedMaskedIp) return cachedMaskedIp;
  if (!masked && cachedIp) return cachedIp;

  const getMasked = (ip) => {
    if (ip.includes(":")) {
      // Handle IPv6
      let fullIp = ip;
      // Remove zone identifier if present
      const zoneIndex = fullIp.indexOf("%");
      if (zoneIndex !== -1) {
        fullIp = fullIp.substring(0, zoneIndex);
      }

      const parts = fullIp.split("::");
      let segments = [];

      if (parts.length === 2) {
        const left = parts[0].split(":").filter((s) => s !== "");
        const right = parts[1].split(":").filter((s) => s !== "");
        const missing = 8 - (left.length + right.length);
        const zeros = Array(missing).fill("0");
        segments = [...left, ...zeros, ...right];
      } else {
        segments = fullIp.split(":");
      }

      // Just to be safe, ensure we have at least 3 segments
      if (segments.length < 3) {
        return segments.join(":");
      }

      return segments.slice(0, 3).join(":");
    }
    // IPv4: mask to first 2 octets
    return ip.split(".").slice(0, 2).join(".");
  };

  try {
    const response = await axios.get("https://api.ipify.org?format=json");
    const data = response.data;
    cachedIp = data.ip;
    cachedMaskedIp = getMasked(data.ip);
    return masked ? cachedMaskedIp : cachedIp;
  } catch (e) {
    console.warn("Primary IP fetch failed, trying backup...", e);
    try {
      const response = await axios.get("https://api.db-ip.com/v2/free/self");
      const data = response.data;
      const ip = data.ipAddress || data.ip;
      cachedIp = ip;
      cachedMaskedIp = getMasked(ip);
      return masked ? cachedMaskedIp : cachedIp;
    } catch (e2) {
      console.warn("All IP fetch attempts failed", e2);
      return "unknown";
    }
  }
};

/**
 * Gets the cached masked IP address.
 * @returns {string|null} The cached masked IP.
 */
export const getCachedMaskedIp = () => cachedMaskedIp;

// --- Marked Parser (Quest Guide Usage) ---
const renderer = new marked.Renderer();

const sanitizeUrlMarked = (url) => {
  if (!url) return "";
  try {
    const decoded = decodeURIComponent(url.toString().trim()).toLowerCase();
    if (decoded.startsWith("javascript:") || decoded.startsWith("vbscript:") || decoded.startsWith("data:") || decoded.startsWith("file:")) {
      return "#";
    }
  } catch { }
  return url.toString().trim();
};

renderer.link = (hrefOrObj, titleArg, textArg) => {
  let href, title, text;
  if (typeof hrefOrObj === "object" && hrefOrObj !== null) {
    ({ href, title, text } = hrefOrObj);
  } else {
    href = hrefOrObj;
    title = titleArg;
    text = textArg;
  }
  const cleanHref = sanitizeUrlMarked(href);
  return `<a href="${cleanHref}" target="_blank" style="color: var(--accent); text-decoration: underline;" title="${title || ''}">${text}</a>`;
};

renderer.image = (hrefOrObj, titleArg, textArg) => {
  let href, title, text;
  if (typeof hrefOrObj === "object" && hrefOrObj !== null) {
    ({ href, title, text } = hrefOrObj);
  } else {
    href = hrefOrObj;
    title = titleArg;
    text = textArg;
  }
  const cleanHref = sanitizeUrlMarked(href);
  return `<img src="${cleanHref}" alt="${text}" title="${title || ''}" loading="lazy" class="quest-step-inline-image" data-action="view-image">`;
};

marked.use({ renderer, breaks: true, gfm: true });

/**
 * Parse text using marked library (Dedicated for Quest Guide)
 * @param {string} text - The markdown text.
 * @returns {string} The converted HTML.
 */
export const parseQuestMarkdown = (text) => {
  if (!text) return "";

  try {
    // Use marked to parse
    let html = marked.parse(text);

    // Post-process custom spoiler tags
    html = html.replace(
      /{spoiler}([\s\S]*?){\/spoiler}/g,
      '<span class="spoiler" data-action="reveal-spoiler">$1</span>',
    );

    return html;
  } catch (e) {
    console.error("Marked parsing error:", e);
    // Fallback? Or just return text
    return text.toString().replace(/\n/g, '<br>');
  }
};

/**
 * Simple Regex Markdown Parser (Legacy/Global Usage)
 * Restored for compatibility with other components
 * @param {string} text - The markdown text.
 * @returns {string} The converted HTML.
 */
export const parseMarkdown = (text) => {
  if (!text) return "";
  let html = text;

  // 1. Lists - Process block-level lists first to avoid conflict with emphasis (*)
  html = html.replace(
    /(^|\r?\n)((?:[-*] .+(?:\r?\n|$))+)/g,
    (match, prefix, list) => {
      const items = list
        .trim()
        .split(/\r?\n/)
        .map((line) => {
          return `<li>${line.replace(/^[-*] /, "")}</li>`;
        })
        .join("");
      return `${prefix}<ul>${items}</ul>`;
    },
  );

  // 2. Headers
  html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gm, "<h1>$1</h1>");

  // 3. Blockquotes
  html = html.replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>");

  // 4. Code Blocks
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 5. HR
  html = html.replace(/^---$/gm, "<hr>");

  // 6. Images & Links
  const sanitizeUrl = (url) => {
    if (!url) return "";
    let decoded;
    try {
      decoded = decodeURIComponent(url.trim()).toLowerCase();
    } catch {
      decoded = url.trim().toLowerCase();
    }
    const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
    if (dangerousProtocols.some((p) => decoded.startsWith(p))) {
      return "#";
    }
    return url;
  };

  const escapeHtml = (str) =>
    str.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) =>
      `<img src="" data-src="${sanitizeUrl(url)}" alt="${escapeHtml(alt)}" loading="lazy" class="quest-step-inline-image lazy-load" data-action="view-image">`,
  );

  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, text, url) =>
      `<a href="${sanitizeUrl(url)}" target="_blank" style="color: var(--accent); text-decoration: underline;">${escapeHtml(text)}</a>`,
  );

  // 7. Emphasis
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Change underscore italic to require boundaries to avoid breaking URLs with underscores
  html = html.replace(/(^|[^\w])_(.*?)_([^\w]|$)/g, "$1<em>$2</em>$3");

  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");

  // 8. Spoilers
  html = html.replace(
    /{spoiler}([\s\S]*?){\/spoiler}/g,
    '<span class="spoiler" data-action="reveal-spoiler">$1</span>',
  );

  return html;
};

/**
 * Resets a GIF animation by reloading its source.
 * @param {Element|null} img - The image element.
 */
export const resetGif = (img) => {
  if (!(img instanceof HTMLImageElement) || !img.src) return;
  const url = img.src.split("?")[0].split("#")[0];
  if (url.toLowerCase().endsWith(".gif")) {
    const src = img.src;
    img.src = "";
    // Use a small delay to ensure the browser registers the empty src
    setTimeout(() => {
      img.src = src;
    }, 0);
  }
};

export { debounce };
