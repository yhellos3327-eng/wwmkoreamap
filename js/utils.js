import { state } from "./state.js";

export const t = (key) => {
  if (!key) return "";
  const trimmedKey = key.toString().trim();
  return state.koDict[trimmedKey] || key;
};

export const getJosa = (word, type) => {
  if (!word || typeof word !== "string") return type.split("/")[0];
  const lastChar = word.charCodeAt(word.length - 1);
  if (lastChar < 0xac00 || lastChar > 0xd7a3) return type.split("/")[0];
  const hasJongsung = (lastChar - 0xac00) % 28 !== 0;
  const [josa1, josa2] = type.split("/");
  return hasJongsung ? josa1 : josa2;
};

export const isPointInPolygon = (point, vs) => {
  let x = point[0],
    y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i][0],
      yi = vs[i][1];
    let xj = vs[j][0],
      yj = vs[j][1];
    let intersect =
      yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const parseCSV = (str) => {
  const arr = [];
  let quote = false;
  let col = 0,
    c = 0;

  for (let row = 0; row < str.length; row++) {
    let cc = str[row],
      nc = str[row + 1];
    
    arr[col] ??= [];
    arr[col][c] ??= "";

    if (cc == '"' && quote && nc == '"') {
      arr[col][c] += cc;
      ++row;
    } else if (cc == "\\" && quote && nc == '"') {
      arr[col][c] += nc;
      ++row;
    } else if (cc == '"') {
      quote = !quote;
    } else if (cc == "," && !quote) {
      ++c;
    } else if (cc == "\r" && nc == "\n" && !quote) {
      ++col;
      c = 0;
      ++row;
    } else if ((cc == "\n" || cc == "\r") && !quote) {
      ++col;
      c = 0;
    } else {
      arr[col][c] += cc;
    }
  }
  return arr;
};

export const fetchWithProgress = async (url, onProgress) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} 로드 실패: ${response.statusText}`);

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;
    if (total && onProgress) {
      onProgress(loaded, total);
    }
  }

  const blob = new Blob(chunks);
  return blob;
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

  const getMasked = (ip) => ip.split(".").slice(0, 2).join(".");

  try {
    
    const response = await fetch("https://api.ipify.org?format=json");
    if (!response.ok) throw new Error("ipify failed");
    const data = await response.json();
    cachedIp = data.ip;
    cachedMaskedIp = getMasked(data.ip);
    return masked ? cachedMaskedIp : cachedIp;
  } catch (e) {
    console.warn("Primary IP fetch failed, trying backup...", e);
    try {
      
      const response = await fetch("https://api.db-ip.com/v2/free/self");
      if (!response.ok) throw new Error("db-ip failed");
      const data = await response.json();
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

  // Horizontal Rule (---)
  html = html.replace(/^---$/gm, "<hr>");

  // Lists (Unordered)
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

  
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" style="color: var(--accent); text-decoration: underline;">$1</a>',
  );

  return html;
};
