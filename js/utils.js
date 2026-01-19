import { state } from "./state.js";
import Papa from "https://esm.run/papaparse@5.4.1";
import { josa } from "https://esm.run/es-hangul@2.3.0";
import pointInPolygon from "https://esm.run/point-in-polygon@1.1.0";
import { debounce } from "https://esm.run/lodash-es@4.17.22";
import axios from "https://esm.run/axios@1.12.0";

export const t = (key) => {
  if (!key) return "";
  const trimmedKey = key.toString().trim();
  return state.koDict[trimmedKey] || key;
};

export const getJosa = (word, type) => {
  if (!word || typeof word !== "string") return type.split("/")[0];
  // es-hangul returns "word+particle", so we slice off the word to get just the particle
  // to maintain backward compatibility with the existing getJosa signature
  const full = josa(word, type);
  return full.slice(word.length);
};
export const isPointInPolygon = (point, vs) => {
  return pointInPolygon(point, vs);
};

export const parseCSV = (str) => {
  const results = Papa.parse(str, {
    header: false,
    skipEmptyLines: false,
  });
  return results.data;
};

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

export const getCachedMaskedIp = () => cachedMaskedIp;

/**
 * Simple Markdown Parser
 * Supports: Bold, Italic, Strikethrough, Links, Headers, Blockquotes, Code, HR
 */
export const parseMarkdown = (text) => {
  if (!text) return "";
  let html = text;

  html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gm, "<h1>$1</h1>");

  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");

  html = html.replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^---$/gm, "<hr>");

  // Lists
  html = html.replace(
    /(^|\n)((?:[-*] .+(?:\n|$))+)/g,
    (match, prefix, list) => {
      const items = list
        .trim()
        .split(/\n/)
        .map((line) => {
          return `<li>${line.replace(/^[-*] /, "")}</li>`;
        })
        .join("");
      return `${prefix}<ul>${items}</ul>`;
    },
  );

  const sanitizeUrl = (url) => {
    // Decode URL to catch encoded attacks
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
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, text, url) =>
      `<a href="${sanitizeUrl(url)}" target="_blank" style="color: var(--accent); text-decoration: underline;">${escapeHtml(text)}</a>`,
  );

  return html;
};

export { debounce };
