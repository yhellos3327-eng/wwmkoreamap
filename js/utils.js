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
  return `<img src="" data-src="${cleanHref}" alt="${text || ""}" title="${title || ""}" loading="lazy" class="quest-step-inline-image lazy-load" data-action="view-image">`;
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

  try {
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

    // 1. 커스텀 레퍼런스(@{ref}) 처리 - 파싱 전 플레이스홀더로 치환
    const refPlaceholders = [];
    let processedText = text.replace(
      /@{ref}(\[.*?\](?:\(.*?\))?)/g,
      (match, content) => {
        const placeholder = `REFPH${refPlaceholders.length}PHREF`;
        refPlaceholders.push({ placeholder, content });
        return placeholder;
      }
    );

    // 2. marked를 사용하여 마크다운 및 HTML 파싱
    // @ts-ignore
    let html = marked.parse(processedText);
    // marked.parse may return a promise if async, but it's sync if no callback is provided in most configs
    if (typeof html !== 'string') {
      // @ts-ignore
      html = String(html);
    }

    // 3. 커스텀 레퍼런스 복구 및 렌더링
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
            return { title: titleMatch[1].trim(), url: sanitizeUrlMarked(urlMatch[1].trim()) };
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
          const rText = singleMatch[1].trim();
          const rUrl = sanitizeUrlMarked(singleMatch[2].trim());
          refHtml = `<div class="reference-item"><svg class="ref-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg><a href="${rUrl}" target="_blank">${escapeHtml(rText)}</a></div>`;
        }
      }

      // html is wrapped in tags, replace global occurrences of placeholders
      html = html.split(placeholder).join(refHtml || content);
    });

    // 4. 스포일러 태그 후처리
    html = html.replace(
      /{spoiler}([\s\S]*?){\/spoiler}/g,
      '<span class="spoiler" data-action="reveal-spoiler">$1</span>',
    );

    return html;
  } catch (e) {
    console.error("parseMarkdown error:", e);
    // 폴백: 줄바꿈만 변환
    return text.toString().replace(/\n/g, '<br>');
  }
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

/**
 * Returns an SVG icon based on the user level.
 * @param {number} level - User level (0-4).
 * @returns {string} SVG string.
 */
export const getUserLevelIcon = (level) => {
  const lv = Number(level) || 0;
  let color, title, content;

  switch (lv) {
    case 1: // 새싹 (Sprout)
      color = "#66BB6A";
      title = "새싹";
      content = `<line x1="12" y1="22" x2="12" y2="12" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/><path d="M12 12c0-5 5-7.5 9-7.5C21 9.5 17 12 12 12z" fill="${color}"/><path d="M12 16c0-3.5-3.5-5.5-7-5.5C5 14.5 8.5 16 12 16z" fill="${color}" opacity="0.7"/>`;
      break;
    case 2: // 숙련자 (Tree)
      color = "#43A047";
      title = "숙련자";
      content = `<path d="M12 2L7 8.5h2.5L6 14.5h3L5.5 21h13L15 14.5h3L14.5 8.5H17z" fill="${color}"/><rect x="10.5" y="20" width="3" height="3" rx="0.5" fill="${color}" opacity="0.6"/>`;
      break;
    case 3: // 전문가 (Star)
      color = "#FFC107";
      title = "전문가";
      content = `<path d="M12 2l2.9 5.8 6.4 1-4.6 4.5 1.1 6.4L12 16.8l-5.8 2.9 1.1-6.4-4.6-4.5 6.4-1z" fill="${color}"/>`;
      break;
    case 4: // 관리자 (Crown)
      color = "#E91E63";
      title = "관리자";
      content = `<path d="M2.5 18l2.5-10L9 13l3-9 3 9 4-5 2.5 10z" fill="${color}"/><rect x="2.5" y="18" width="19" height="3.5" rx="1" fill="${color}" opacity="0.8"/><circle cx="12" cy="4" r="1.5" fill="${color}"/><circle cx="5" cy="8" r="1.5" fill="${color}"/><circle cx="19" cy="8" r="1.5" fill="${color}"/>`;
      break;
    default: // 익명 (Anonymous)
      color = "#9E9E9E";
      title = "익명";
      content = `<circle cx="12" cy="8" r="4" fill="${color}" opacity="0.6"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="${color}" opacity="0.35"/>`;
  }

  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 4px;" title="${title}">${content}</svg>`;
};

/**
 * Masks an identifier (IP address or Fingerprint).
 * @param {string} value - The identifier to mask.
 * @param {'ip'|'fp'} type - The type of identifier.
 * @returns {string} Masked string.
 */
export const maskIdentifier = (value, type) => {
  if (!value || value === 'unknown') return '알 수 없음';

  if (type === 'ip') {
    if (value.includes(':')) {
      // IPv6: First 3 segments
      const parts = value.split(':');
      return parts.slice(0, 3).join(':');
    }
    // IPv4: First 2 octets
    const parts = value.split('.');
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[1]}`;
    }
    return value.substring(0, 5);
  } else {
    // Fingerprint: Keep first 4 chars
    return value.substring(0, 4);
  }
};

export { debounce };
