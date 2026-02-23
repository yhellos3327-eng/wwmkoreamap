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
 * 상태 내의 한국어 사전을 사용하여 키를 번역합니다.
 * @param {string|number} key - 번역할 키.
 * @returns {string|number} 번역된 문자열 또는 원래 키.
 */
export const t = (key) => {
  if (!key) return "";
  const trimmedKey = key.toString().trim();
  return state.koDict[trimmedKey] || key;
};

/**
 * 단어에 맞는 올바른 한국어 조사를 가져옵니다.
 * @param {string} word - 조사를 붙일 단어.
 * @param {string} type - 조사의 종류 (예: '이/가', '을/를').
 * @returns {string} 조사.
 */
export const getJosa = (word, type) => {
  if (!word || typeof word !== "string") return type.split("/")[0];
  const full = josa(word, type);
  return full.slice(word.length);
};

/**
 * 점이 다각형 내부에 있는지 확인합니다.
 * @param {number[]} point - 점의 좌표 [x, y].
 * @param {number[][]} vs - 다각형의 정점 리스트 [[x, y], ...].
 * @returns {boolean} 점이 다각형 내부에 있으면 true.
 */
export const isPointInPolygon = (point, vs) => {
  return pointInPolygon(point, vs);
};

/**
 * CSV 문자열을 배열의 배열로 파싱합니다.
 * @param {string} str - CSV 문자열.
 * @returns {string[][]} 파싱된 데이터.
 */
export const parseCSV = (str) => {
  const results = Papa.parse(str, {
    header: false,
    skipEmptyLines: false,
  });
  return results.data;
};

/**
 * 진행률 추적과 함께 URL을 호출하여 데이터를 가져옵니다.
 * @param {string} url - 호출할 URL.
 * @param {function(number, number): void} [onProgress] - 진행률 업데이트를 위한 콜백 (loaded, total).
 * @returns {Promise<Blob>} Blob 형태의 응답 데이터.
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
 * CSV 파일을 청크 단위로 가져오고 파싱합니다.
 * @param {string} url - CSV 파일의 URL.
 * @param {function(string[][], string[]|null): void} onChunk - 각 데이터 청크에 대한 콜백.
 * @param {function(): void} [onComplete] - 파싱이 완료되었을 때의 콜백.
 * @param {function(number, number): void} [onProgress] - 다운로드 진행률에 대한 콜백.
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
 * 사용자의 IP 주소를 가져옵니다.
 * @param {boolean} [masked=true] - 마스킹된 IP를 반환할지 여부.
 * @returns {Promise<string>} 사용자의 IP 주소.
 */
export const fetchUserIp = async (masked = true) => {
  if (masked && cachedMaskedIp) return cachedMaskedIp;
  if (!masked && cachedIp) return cachedIp;

  const getMasked = (ip) => {
    if (ip.includes(":")) {
      // Handle IPv6
      let fullIp = ip;
      // Zone identifier가 있는 경우 제거
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

      // 안전을 위해 최소 3개의 세그먼트가 있는지 확인
      if (segments.length < 3) {
        return segments.join(":");
      }

      return segments.slice(0, 3).join(":");
    }
    // IPv4: 첫 2개 옥텟만 마스킹
    return ip.split(".").slice(0, 2).join(".");
  };

  try {
    const response = await axios.get("https://api.ipify.org?format=json");
    const data = response.data;
    cachedIp = data.ip;
    cachedMaskedIp = getMasked(data.ip);
    return masked ? cachedMaskedIp : cachedIp;
  } catch (e) {
    console.warn("기본 IP 조치 실패, 백업 시도 중...", e);
    try {
      const response = await axios.get("https://api.db-ip.com/v2/free/self");
      const data = response.data;
      const ip = data.ipAddress || data.ip;
      cachedIp = ip;
      cachedMaskedIp = getMasked(ip);
      return masked ? cachedMaskedIp : cachedIp;
    } catch (e2) {
      console.warn("모든 IP 조회 시도 실패", e2);
      return "unknown";
    }
  }
};

/**
 * 캐시된 마스킹 IP 주소를 가져옵니다.
 * @returns {string|null} 캐시된 마스킹 IP.
 */
export const getCachedMaskedIp = () => cachedMaskedIp;

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
 * marked 라이브러리를 사용하여 텍스트를 파싱합니다 (퀘스트 가이드 전용).
 * @param {string} text - 마크다운 텍스트.
 * @returns {string} 변환된 HTML.
 */
export const parseQuestMarkdown = (text) => {
  if (!text) return "";

  try {
    // marked를 사용하여 파싱
    let html = marked.parse(text);

    // 커스텀 스포일러 태그 후처리
    html = html.replace(
      /{spoiler}([\s\S]*?){\/spoiler}/g,
      '<span class="spoiler" data-action="reveal-spoiler">$1</span>',
    );

    return html;
  } catch (e) {
    console.error("Marked parsing error:", e);
    // 폴백: 줄바꿈만 변환하여 반환
    return text.toString().replace(/\n/g, '<br>');
  }
};

/**
 * 단순 정규식 마크다운 파서 (레거시/전역용).
 * 다른 컴포넌트와의 호환성을 위해 유지됩니다.
 * @param {string} text - 마크다운 텍스트.
 * @returns {string} 변환된 HTML.
 */
export const parseMarkdown = (text) => {
  if (!text) return "";
  let html = text;

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

  // 1. 목록 - 강조(*)와의 충돌을 피하기 위해 블록 수준 목록을 먼저 처리

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
  html = html.replace(/(?:^|[\r\n]|<br\s*\/?>)\s*### (.*$)/gm, "<h3>$1</h3>");
  html = html.replace(/(?:^|[\r\n]|<br\s*\/?>)\s*## (.*$)/gm, "<h2>$1</h2>");
  html = html.replace(/(?:^|[\r\n]|<br\s*\/?>)\s*# (.*$)/gm, "<h1>$1</h1>");

  // 3. Blockquotes
  html = html.replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>");

  // 4. Code Blocks
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 5. HR
  html = html.replace(/^---$/gm, "<hr>");

  // 6. Custom Reference Item (Placeholder to prevent link parser collision)
  const refPlaceholders = [];
  html = html.replace(
    /@{ref}(\[.*?\](?:\(.*?\))?)/g,
    (match, content) => {
      const placeholder = `__REF_PLACEHOLDER_${refPlaceholders.length}__`;
      refPlaceholders.push({ placeholder, content });
      return placeholder;
    }
  );

  // 7. Images & Links
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

  refPlaceholders.forEach(({ placeholder, content }) => {
    let refHtml = "";
    if (content.includes("{t:")) {
      const cleanContent = content.startsWith("[") && content.endsWith("]")
        ? content.slice(1, -1)
        : content;

      const items = cleanContent.split("|").map(item => {
        const titleMatch = item.match(/t:(.*?),/);
        const urlMatch = item.match(/u:(.*?)(?:}|$)/);
        if (titleMatch && urlMatch) {
          return { title: titleMatch[1].trim(), url: sanitizeUrl(urlMatch[1].trim()) };
        }
        return null;
      }).filter(Boolean);

      if (items.length > 0) {
        const listHtml = items.map(item => `
          <div class="reference-item">
            <svg class="ref-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <a href="${item.url}" target="_blank">${escapeHtml(item.title)}</a>
          </div>`).join("");
        refHtml = `<div class="reference-thread">${listHtml}</div>`;
      }
    } else {
      const singleMatch = content.match(/\[(.*?)\]\((.*?)\)/);
      if (singleMatch) {
        const text = singleMatch[1].trim();
        const url = sanitizeUrl(singleMatch[2].trim());
        refHtml = `<div class="reference-item"><svg class="ref-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg><a href="${url}" target="_blank">${escapeHtml(text)}</a></div>`;
      }
    }
    html = html.replace(placeholder, refHtml || content);
  });

  // 7. Emphasis
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // URL의 언더스코어가 깨지지 않도록 경계 조건 추가
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
 * 소스를 다시 로드하여 GIF 애니메이션을 초기화합니다.
 * @param {Element|null} img - 이미지 요소.
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
