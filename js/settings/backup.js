// @ts-check
/// <reference path="../types.d.ts" />
import { isLoggedIn } from "../auth.js";
import { setLocalData } from "../sync.js";
import {
  fetchBackupList,
  saveCloudBackup,
  restoreFromBackup,
} from "../sync/api.js";
import {
  runIntegrityCheck,
  initIntegrityModal,
  showResultAlert,
  initResultAlertModal,
} from "../integrity.js";
import { state } from "../state.js";
import { t } from "../utils.js";
import { MAP_CONFIGS } from "../config.js";
import { getMarkerId } from "../sync/merge.js";

const ICONS = {
  eye: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
  package: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
  trophy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 2.2h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"></path><path d="M6 9v3a6 6 0 0 0 12 0V9"></path><line x1="12" y1="15" x2="12" y2="23"></line><path d="M8 23h8"></path></svg>`,
  star: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
  sliders: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`
};

/**
 * Formats a date string for display.
 * @param {string} dateStr - The date string to format.
 * @returns {string} The formatted date string.
 */
const formatBackupDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Normalizes backup data by converting stringified booleans and arrays.
 * @param {any} data - The backup data.
 * @returns {any} The normalized data.
 */
const normalizeData = (data) => {
  if (!data || !data.settings) return data;
  const s = data.settings;

  const boolFields = [
    "showAd",
    "showComments",
    "hideCompleted",
    "enableClustering",
    "closeOnComplete",
  ];
  boolFields.forEach((key) => {
    if (typeof s[key] === "string") {
      s[key] = s[key] === "true";
    }
  });

  const arrayFields = [
    "activeCatsQinghe",
    "activeCatsKaifeng",
    "activeCatsDreamsunsun",
    "activeRegsQinghe",
    "activeRegsKaifeng",
    "activeRegsDreamsunsun",
    "favoritesQinghe",
    "favoritesKaifeng",
    "favoritesDreamsunsun",
  ];
  arrayFields.forEach((key) => {
    if (typeof s[key] === "string") {
      try {
        const parsed = JSON.parse(s[key]);
        if (Array.isArray(parsed)) s[key] = parsed;
      } catch (e) { }
    }
  });
  return data;
};

/**
 * Renders the list of backups.
 * @param {any[]} backups - The list of backups.
 */
const renderBackupList = (backups) => {
  const container = document.getElementById("cloud-backup-list");
  if (!container) return;

  if (!backups || backups.length === 0) {
    container.innerHTML =
      '<div class="backup-empty-state">저장된 백업이 없습니다.</div>';
    return;
  }

  container.innerHTML = backups
    .map(
      (backup, index) => `
        <div class="backup-item" data-backup-id="${backup.id}">
            <div class="backup-info">
                <span class="backup-label">${backup.label || `백업 #${backups.length - index}`}</span>
                <span class="backup-date">${formatBackupDate(backup.created_at)}</span>
                <span class="backup-stats">완료: ${backup.completed_count || 0}개</span>
            </div>
            <button class="backup-restore-btn" data-backup-id="${backup.id}">복원</button>
        </div>
    `,
    )
    .join("");

  container.querySelectorAll(".backup-restore-btn").forEach((btn) => {
    btn.addEventListener("click", handleRestore);
  });
};

/**
 * Handles the restore button click.
 * @param {Event} e - The click event.
 */
const handleRestore = async (e) => {
  const btn = /** @type {HTMLButtonElement} */ (e.target);
  const backupId = btn.dataset.backupId;

  try {
    btn.disabled = true;
    btn.textContent = "검사 중...";

    const result = await restoreFromBackup(backupId);

    if (result.success && result.data) {
      btn.textContent = "복원";
      btn.disabled = false;

      const normalizedData = normalizeData(result.data);

      runIntegrityCheck(normalizedData, async (validatedData) => {
        try {
          setLocalData(validatedData);
          await showResultAlert(
            "success",
            "복원 완료",
            "백업이 성공적으로 복원되었습니다. 페이지를 새로고침합니다.",
            true,
          );
        } catch (error) {
          console.error("Restore failed:", error);
          showResultAlert(
            "error",
            "복원 실패",
            "복원에 실패했습니다: " + error.message,
          );
        }
      });
    } else {
      throw new Error("백업 데이터를 가져올 수 없습니다.");
    }
  } catch (error) {
    console.error("Restore failed:", error);
    showResultAlert(
      "error",
      "복원 실패",
      "복원에 실패했습니다: " + error.message,
    );
    btn.disabled = false;
    btn.textContent = "복원";
  }
};

/**
 * Loads the list of cloud backups.
 */
export const loadCloudBackups = async () => {
  const container = document.getElementById("cloud-backup-list");
  if (!container) return;

  container.innerHTML = '<div class="backup-loading">불러오는 중...</div>';

  try {
    const backups = await fetchBackupList();
    renderBackupList(backups);
  } catch (error) {
    console.error("Failed to load backups:", error);
    container.innerHTML =
      '<div class="backup-error">백업 목록을 불러올 수 없습니다.</div>';
  }
};

const SAVE_BUTTON_HTML = `
    <span class="icon-mask"
        style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'/%3E%3Cpolyline points='17 21 17 13 7 13 7 21'/%3E%3Cpolyline points='7 3 7 8 15 8'/%3E%3C/svg%3E&quot;);"></span>
    현재 상태를 클라우드에 스냅샷 저장
`;

/**
 * Updates the visibility of the cloud backup section based on login status.
 */
export const refreshCloudBackupVisibility = () => {
  const cloudBackupSection = document.getElementById("cloud-backup-section");
  if (!cloudBackupSection) return;

  if (isLoggedIn()) {
    cloudBackupSection.style.display = "block";
    loadCloudBackups();
  } else {
    cloudBackupSection.style.display = "none";
  }
};

/**
 * Initializes the cloud backup section.
 */
export const initCloudBackupSection = () => {
  initVaultBackupSection();

  const cloudBackupSection = document.getElementById("cloud-backup-section");
  const saveBtn = document.getElementById("btn-cloud-backup-save");
  const openSettingsBtn = document.getElementById("open-settings");

  initIntegrityModal();
  initResultAlertModal();

  if (!cloudBackupSection) return;

  // Initial check
  refreshCloudBackupVisibility();

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", () => {
      setTimeout(refreshCloudBackupVisibility, 100);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!isLoggedIn()) {
        showResultAlert(
          "warning",
          "로그인 필요",
          "클라우드 백업을 사용하려면 로그인이 필요합니다.",
        );
        return;
      }

      const label = prompt("백업 이름을 입력하세요 (선택사항):");

      try {
        /** @type {HTMLButtonElement} */ (saveBtn).disabled = true;
        saveBtn.textContent = "저장 중...";

        const result = await saveCloudBackup(label || null);
        if (result.success) {
          showResultAlert(
            "success",
            "백업 저장 완료",
            "클라우드에 백업이 성공적으로 저장되었습니다.",
          );
          loadCloudBackups();
        }
      } catch (error) {
        console.error("Backup save failed:", error);
        showResultAlert(
          "error",
          "백업 실패",
          "백업 저장에 실패했습니다: " + error.message,
        );
      } finally {
        /** @type {HTMLButtonElement} */ (saveBtn).disabled = false;
        saveBtn.innerHTML = SAVE_BUTTON_HTML;
      }
    });
  }
};

// --- Vault (Local Backup) Logic ---

import { getVaultHistory, restoreFromVault, saveToVault } from "../storage/vault.js";

/**
 * Renders the list of Vault (local) backups.
 * @param {any[]} backups - The list of backups.
 */
const renderVaultList = (backups) => {
  const container = document.getElementById("vault-backup-list");
  if (!container) return;

  if (!backups || backups.length === 0) {
    container.innerHTML =
      '<div class="backup-empty-state">저장된 로컬 백업이 없습니다.</div>';
    return;
  }

  container.innerHTML = backups
    .map(
      (backup) => `
        <div class="backup-item" data-backup-id="${backup.id}">
            <div class="backup-info">
                <span class="backup-label">
                    ${backup.reason === 'auto' ? '자동 백업' :
          backup.reason === 'manual' ? '수동 저장' :
            backup.reason === 'init' ? '초기화 전 백업' :
              backup.reason === 'sync_success' ? '동기화 후 저장' :
                backup.reason === 'pre_cloud_save' ? '클라우드 저장 전 백업' :
                  backup.reason === 'pre_full_sync' ? '전체 동기화 전 백업' :
                    backup.reason === 'auto_save' ? '자동 저장' : backup.reason}
                </span>
                <span class="backup-date">${formatBackupDate(backup.timestamp)}</span>
                <span class="backup-stats">크기: ${Math.round(backup.size / 1024)}KB</span>
            </div>
            <div class="backup-actions">
                <button class="vault-restore-btn" data-backup-id="${backup.id}">복원</button>
                <button class="vault-inspect-btn" data-backup-id="${backup.id}" title="데이터 구조 확인">${ICONS.eye}</button>
            </div>
        </div>
    `,
    )
    .join("");

  container.querySelectorAll(".vault-restore-btn").forEach((btn) => {
    btn.addEventListener("click", handleVaultRestore);
  });

  container.querySelectorAll(".vault-inspect-btn").forEach((btn) => {
    btn.addEventListener("click", handleVaultInspect);
  });
};

/**
 * Syntax highlights JSON string.
 * @param {Object} json - The JSON object.
 * @returns {string} HTML string with syntax highlighting.
 */
const syntaxHighlight = (json) => {
  let str = JSON.stringify(json, undefined, 4);
  str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'key';
      } else {
        cls = 'string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'boolean';
    } else if (/null/.test(match)) {
      cls = 'null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
};

/** @type {Map<string, string>} Cache for all marker names across all maps */
let allMarkerNamesCache = new Map();
/** @type {Map<string, string>} Cache for category ID to name mapping */
let categoryNamesCache = new Map();
/** @type {Map<string, string>} Cache for marker ID to category ID mapping (from missing_data.csv) */
let markerToCategoryCache = new Map();
let markerNamesCacheLoaded = false;

/**
 * Parses a CSV line handling quoted fields with commas.
 * @param {string} line - The CSV line to parse.
 * @returns {string[]} Array of field values.
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

/**
 * Loads all marker names from all CSV files (data, translation).
 * @returns {Promise<void>}
 */
const loadAllMarkerNames = async () => {
  if (markerNamesCacheLoaded) return;

  try {
    // 1. Load from data CSV files (data3.csv, data4.csv)
    const mapKeys = Object.keys(MAP_CONFIGS);

    for (const mapKey of mapKeys) {
      const config = MAP_CONFIGS[mapKey];
      if (!config.newDataFile) continue;

      try {
        const response = await fetch(config.newDataFile);
        if (!response.ok) continue;

        const csvText = await response.text();
        const lines = csvText.split('\n');

        const headers = parseCSVLine(lines[0] || '').map(h => h.toLowerCase());
        if (!headers.length) continue;

        const idIndex = headers.findIndex(h => h === 'id');
        const titleIndex = headers.findIndex(h => h === 'title');
        const nameIndex = headers.findIndex(h => h === 'name');
        const nameFieldIndex = titleIndex !== -1 ? titleIndex : nameIndex;

        if (idIndex === -1 || nameFieldIndex === -1) continue;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = parseCSVLine(line);
          const id = cols[idIndex];
          const name = cols[nameFieldIndex];

          if (id && name) {
            allMarkerNamesCache.set(String(id), name);
          }
        }
      } catch (e) {
        console.warn(`[BackupInspect] Failed to load names from ${mapKey}:`, e);
      }
    }

    // 2. Load from translation CSV files (Override entries have ID-specific names, Common has category names)
    const translationFiles = ['./translation.csv', './translation2.csv'];

    for (const file of translationFiles) {
      try {
        const response = await fetch(file);
        if (!response.ok) continue;

        const csvText = await response.text();
        const lines = csvText.split('\n');

        const headers = parseCSVLine(lines[0] || '');
        if (!headers.length) continue;

        const typeIdx = headers.findIndex(h => h === 'Type');
        const keyIdx = headers.findIndex(h => h === 'Key');
        const koreanIdx = headers.findIndex(h => h === 'Korean');

        if (typeIdx === -1 || keyIdx === -1 || koreanIdx === -1) continue;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = parseCSVLine(line);
          const type = cols[typeIdx];
          const key = cols[keyIdx];
          const korean = cols[koreanIdx];

          if (!key || !korean) continue;

          if (type === 'Override') {
            // Override type has marker-specific translations (key is marker ID)
            allMarkerNamesCache.set(String(key), korean);
          } else if (type === 'Common') {
            // Common type has category names (key is category ID like 17310010003)
            categoryNamesCache.set(String(key), korean);
          }
        }
      } catch (e) {
        console.warn(`[BackupInspect] Failed to load names from ${file}:`, e);
      }
    }

    // 3. Load missing_data.csv for marker ID to category ID mapping
    try {
      const response = await fetch('./missing_data.csv');
      if (response.ok) {
        const csvText = await response.text();
        const lines = csvText.split('\n');

        // Header: CategoryID,ID
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = line.split(',');
          const categoryId = cols[0]?.trim();
          const markerId = cols[1]?.trim();

          if (categoryId && markerId) {
            markerToCategoryCache.set(String(markerId), categoryId);
          }
        }
      }
    } catch (e) {
      console.warn('[BackupInspect] Failed to load missing_data.csv:', e);
    }

    markerNamesCacheLoaded = true;
    console.log(`[BackupInspect] Loaded ${allMarkerNamesCache.size} marker names, ${categoryNamesCache.size} categories from all sources`);
  } catch (e) {
    console.error('[BackupInspect] Failed to load marker names:', e);
  }
};

/**
 * Gets the localized name of a marker by its ID.
 * @param {string|number|any} id - The marker ID.
 * @returns {string} The localized name or the ID if not found.
 */
const getMarkerName = (id) => {
  const markerId = (id && typeof id === 'object') ? id.id : id;
  if (markerId === undefined || markerId === null) return 'Unknown';

  const strId = String(markerId);

  // 1. Try current map's allMarkers
  let marker = state.allMarkers?.get(strId) || state.allMarkers?.get(Number(markerId));
  if (marker) {
    let name = String(t(marker.originalName || marker.name));
    if (marker.region) {
      name = name.replace('{region}', String(t(marker.region)));
    }
    return name;
  }

  // 2. Check global names map (populated from CSVs)
  const globalName = state.globalMarkerNames?.get(strId) || state.globalMarkerNames?.get(Number(markerId));
  if (globalName) {
    return String(t(globalName));
  }

  // 3. Check pre-loaded cache from all maps (direct marker name)
  const cachedName = allMarkerNamesCache.get(strId);
  if (cachedName) {
    return String(t(cachedName));
  }

  // 4. Check if marker is in missing_data.csv -> get category name
  const categoryId = markerToCategoryCache.get(strId);
  if (categoryId) {
    const categoryName = categoryNamesCache.get(categoryId);
    if (categoryName) {
      return String(t(categoryName));
    }
  }

  // 5. If the backup item itself has a title or name
  if (id && typeof id === 'object' && (id.title || id.name)) {
    return String(t(id.title || id.name));
  }

  // 6. Fallback for user-added markers (timestamp-based IDs)
  if (Number(markerId) > 1000000000000) {
    return `사용자 추가 마커`;
  }

  // 7. Last resort - show shortened ID
  return `마커 #${strId.slice(-6)}`;
};

/**
 * Formats the inspection data into a readable HTML structure.
 * @param {Object} data - The raw data object.
 * @returns {string} The formatted HTML.
 */
const formatInspectData = (data) => {
  // --- Summary View HTML ---
  let summaryHtml = '<div class="inspect-container">';

  // 1. 진행 상황 (Completed)
  if (data.wwm_completed) {
    try {
      const completed = JSON.parse(data.wwm_completed);
      summaryHtml += `
        <div class="inspect-section">
            <h4>${ICONS.trophy} 진행 상황 (${completed.length}개)</h4>
            <div class="inspect-content">
                <div class="tag-list">
                    ${completed.map(c => `<span class="tag">${getMarkerName(c)}</span>`).join('')}
                </div>
            </div>
        </div>`;
    } catch (e) { summaryHtml += `<div class="error">진행 상황 데이터 오류</div>`; }
  }

  // 2. 즐겨찾기 (Favorites)
  if (data.wwm_favorites) {
    try {
      const favorites = JSON.parse(data.wwm_favorites);
      summaryHtml += `
        <div class="inspect-section">
            <h4>${ICONS.star} 즐겨찾기 (${favorites.length}개)</h4>
            <div class="inspect-content">
                <div class="tag-list">
                    ${favorites.map(f => `<span class="tag favorite">${getMarkerName(f)}</span>`).join('')}
                </div>
            </div>
        </div>`;
    } catch (e) { summaryHtml += `<div class="error">즐겨찾기 데이터 오류</div>`; }
  }

  // 3. 필터 설정 (Filters)
  const filterKeys = Object.keys(data).filter(k => k.startsWith('wwm_active_'));
  if (filterKeys.length > 0) {
    summaryHtml += `<div class="inspect-section"><h4>${ICONS.sliders} 필터 설정</h4><div class="inspect-content">`;
    filterKeys.forEach(key => {
      try {
        const filters = JSON.parse(data[key]);
        const mapName = key.replace('wwm_active_cats_', '').replace('wwm_active_regs_', '');
        const type = key.includes('cats') ? '카테고리' : '지역';
        const displayName = MAP_CONFIGS[mapName]?.name || mapName;
        summaryHtml += `
            <div class="inspect-row">
                <span class="label">${displayName} ${type}</span>
                <span class="value">${filters.length}개 선택됨</span>
            </div>`;
      } catch (e) { }
    });
    summaryHtml += `</div></div>`;
  }

  // 4. 기타 설정 (Others)
  const otherKeys = Object.keys(data).filter(k =>
    !k.startsWith('wwm_active_') &&
    k !== 'wwm_completed' &&
    k !== 'wwm_favorites'
  );

  if (otherKeys.length > 0) {
    summaryHtml += `<div class="inspect-section"><h4>${ICONS.settings} 기타 설정</h4><div class="inspect-content">`;
    otherKeys.forEach(key => {
      let val = data[key];
      if (val === 'true') val = '<span class="bool-true">ON</span>';
      else if (val === 'false') val = '<span class="bool-false">OFF</span>';

      summaryHtml += `
        <div class="inspect-row">
            <span class="label">${key}</span>
            <span class="value">${val}</span>
        </div>`;
    });
    summaryHtml += `</div></div>`;
  }
  summaryHtml += '</div>';

  // --- DB Structure View HTML ---
  let dbHtml = `
    <div class="db-view-container">
        <table class="db-table">
            <thead>
                <tr>
                    <th>Key (Field)</th>
                    <th>Value (Data)</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(data).map(([key, value]) => {
    let displayValue = value;
    let displayType = String(typeof value);
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        displayType = `Array(${parsed.length})`;
        displayValue = `<div class="db-cell-array">${parsed.slice(0, 3).map(i => `<span class="db-tag">${getMarkerId(i)}</span>`).join('')}${parsed.length > 3 ? '...' : ''}</div>`;
      } else if (typeof parsed === 'object') {
        displayType = 'Object';
        displayValue = `<pre class="db-cell-json">${JSON.stringify(parsed, null, 2)}</pre>`;
      }
    } catch (e) { }

    return `
                        <tr>
                            <td class="db-key">${key}</td>
                            <td class="db-value">${displayValue}</td>
                            <td class="db-type"><span class="type-badge ${displayType.toLowerCase().split('(')[0]}">${displayType}</span></td>
                        </tr>
                    `;
  }).join('')}
            </tbody>
        </table>
    </div>
  `;

  // --- Raw View HTML ---
  const rawHtml = `
    <div class="raw-view-container">
        <div class="raw-actions">
            <button class="copy-raw-btn" onclick="copyInspectRaw()">📋 복사</button>
        </div>
        <pre class="json-view">${syntaxHighlight(data)}</pre>
    </div>
  `;

  // --- Combined Tabs ---
  return `
    <div class="inspect-tabs">
        <button class="inspect-tab active" data-tab="summary" onclick="switchInspectTab('summary')">요약 보기</button>
        <button class="inspect-tab" data-tab="db" onclick="switchInspectTab('db')">DB 구조 보기</button>
        <button class="inspect-tab" data-tab="raw" onclick="switchInspectTab('raw')">원본 보기 (RAW)</button>
    </div>
    <div id="inspect-view-summary" class="inspect-view">${summaryHtml}</div>
    <div id="inspect-view-db" class="inspect-view hidden">${dbHtml}</div>
    <div id="inspect-view-raw" class="inspect-view hidden">${rawHtml}</div>
    
    <style>
        .inspect-tabs { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 20px; 
            padding: 4px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .inspect-tab { 
            flex: 1;
            background: transparent; 
            border: none; 
            color: #888; 
            padding: 10px 16px; 
            cursor: pointer; 
            font-weight: 600; 
            font-size: 0.9rem; 
            border-radius: 8px; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }
        .inspect-tab:hover { 
            color: #fff; 
            background: rgba(255, 255, 255, 0.05); 
        }
        .inspect-tab.active { 
            color: #fff; 
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
        }
        .inspect-tab.active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 3px;
            background: var(--accent, #d4af37);
            border-radius: 3px 3px 0 0;
            box-shadow: 0 0 10px var(--accent, #d4af37);
        }
        
        .inspect-view.hidden { display: none; }
        
        .inspect-container { display: flex; flex-direction: column; gap: 15px; }
        .inspect-section { 
            background: rgba(255, 255, 255, 0.02); 
            border-radius: 12px; 
            padding: 16px; 
            border: 1px solid rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(5px);
        }
        .inspect-section h4 { margin: 0 0 12px 0; color: var(--accent, #d4af37); font-size: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 8px; font-weight: 700; display: flex; align-items: center; }
        .inspect-section h4 svg { width: 18px; height: 18px; margin-right: 8px; stroke-width: 2px; }
        .tag-list { display: flex; flex-wrap: wrap; gap: 6px; max-height: 150px; overflow-y: auto; padding-right: 4px; }
        .tag-list::-webkit-scrollbar { width: 4px; }
        .tag-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
        .tag { background: rgba(255, 255, 255, 0.05); padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; color: #ddd; border: 1px solid rgba(255, 255, 255, 0.05); }
        .tag.favorite { background: rgba(255, 215, 0, 0.05); color: #ffd700; border-color: rgba(255, 215, 0, 0.1); }
        .inspect-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed rgba(255, 255, 255, 0.05); }
        .inspect-row:last-child { border-bottom: none; }
        .inspect-row .label { color: #888; font-size: 0.85rem; }
        .inspect-row .value { color: #eee; font-size: 0.85rem; font-family: 'JetBrains Mono', monospace; }
        .bool-true { color: #4caf50; font-weight: bold; }
        .bool-false { color: #f44336; font-weight: bold; }

        .raw-view-container { 
            position: relative; 
            background: rgba(0, 0, 0, 0.3); 
            border-radius: 16px; 
            border: 1px solid rgba(255, 255, 255, 0.05); 
            overflow: hidden;
            backdrop-filter: blur(10px);
        }
        .raw-actions { position: absolute; top: 12px; right: 12px; z-index: 10; }
        .copy-raw-btn { 
            background: rgba(255, 255, 255, 0.05); 
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1); 
            color: #ccc; 
            padding: 6px 12px; 
            border-radius: 8px; 
            font-size: 0.75rem; 
            cursor: pointer; 
            transition: all 0.2s;
            font-weight: 600;
        }
        .copy-raw-btn:hover { 
            background: rgba(255, 255, 255, 0.1); 
            color: #fff; 
            transform: translateY(-1px);
        }
        .copy-raw-btn:active { transform: translateY(0); }
        
        .json-view { 
            margin: 0; 
            padding: 24px; 
            color: #d4d4d4; 
            font-family: 'Consolas', 'Monaco', monospace; 
            font-size: 13px; 
            line-height: 1.6; 
            white-space: pre-wrap; 
            word-break: break-all; 
            max-height: 500px; 
            overflow-y: auto; 
        }
        .json-view::-webkit-scrollbar { width: 8px; }
        .json-view::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .json-view .string { color: #ce9178; }
        .json-view .number { color: #b5cea8; }
        .json-view .boolean { color: #569cd6; }
        .json-view .null { color: #569cd6; }
        .json-view .key { color: #9cdcfe; }

        /* DB View Styles */
        .db-view-container {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            overflow-x: auto;
        }
        .db-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
            color: #ccc;
        }
        .db-table th {
            text-align: left;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--accent, #d4af37);
            font-weight: 700;
            border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        }
        .db-table td {
            padding: 10px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            vertical-align: top;
        }
        .db-key {
            font-family: 'JetBrains Mono', monospace;
            color: #9cdcfe;
            font-weight: 600;
            white-space: nowrap;
        }
        .db-value {
            max-width: 300px;
            word-break: break-all;
        }
        .db-cell-array {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        .db-tag {
            background: rgba(255, 255, 255, 0.05);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.75rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .db-cell-json {
            margin: 0;
            font-size: 0.75rem;
            color: #ce9178;
            background: rgba(0,0,0,0.2);
            padding: 8px;
            border-radius: 6px;
            max-height: 100px;
            overflow-y: auto;
        }
        .type-badge {
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .type-badge.string { background: rgba(206, 145, 120, 0.2); color: #ce9178; }
        .type-badge.array { background: rgba(181, 206, 168, 0.2); color: #b5cea8; }
        .type-badge.object { background: rgba(86, 156, 214, 0.2); color: #569cd6; }
    </style>
  `;
};

/**
 * Handles the Vault inspect button click.
 * @param {Event} e - The click event.
 */
const handleVaultInspect = async (e) => {
  // SAFETY FIX: Handle click on SVG icon inside button
  const btn = /** @type {HTMLButtonElement} */ (
    /** @type {HTMLElement} */ (e.target).closest('.vault-inspect-btn')
  );
  if (!btn || !btn.dataset.backupId) {
    console.error("[VaultInspect] Button or backupId not found");
    return;
  }
  const backupId = Number(btn.dataset.backupId);

  if (isNaN(backupId) || backupId <= 0) {
    console.error("[VaultInspect] Invalid backupId:", btn.dataset.backupId);
    alert("유효하지 않은 백업 ID입니다.");
    return;
  }

  try {
    // Load all marker names for proper display
    await loadAllMarkerNames();

    const entry = await import("../storage/db.js").then(m => m.db.get(backupId));
    if (!entry || !entry.data) {
      alert("데이터를 불러올 수 없습니다.");
      return;
    }

    // Create a temporary modal for inspection
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.7); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
        width: 700px; max-width: 95%; max-height: 85vh; 
        background: rgba(30, 30, 30, 0.8); 
        border-radius: 24px;
        display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1); 
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
        animation: modal-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
    `;

    const header = document.createElement("div");
    header.style.cssText = `
        padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.1);
        display: flex; justify-content: space-between; align-items: center;
        background: rgba(255,255,255,0.02);
    `;
    header.innerHTML = `<h3 style="margin:0; color:#fff; font-size: 1.1rem; font-weight: 700; letter-spacing: -0.5px; display:flex; align-items:center; gap:8px;">${ICONS.package} 백업 데이터 상세 (ID: ${backupId})</h3>`;

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
        background: rgba(255,255,255,0.05); border: none; color: #888; font-size: 24px;
        cursor: pointer; width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s; line-height: 1;
    `;
    closeBtn.onmouseover = () => { closeBtn.style.background = 'rgba(255,255,255,0.1)'; closeBtn.style.color = '#fff'; };
    closeBtn.onmouseout = () => { closeBtn.style.background = 'rgba(255,255,255,0.05)'; closeBtn.style.color = '#888'; };
    closeBtn.onclick = () => document.body.removeChild(overlay);
    header.appendChild(closeBtn);

    const content = document.createElement("div");
    content.style.cssText = `flex: 1; overflow-y: auto; padding: 24px;`;
    content.innerHTML = formatInspectData(entry.data);

    // Add global functions for this modal
    // @ts-ignore
    window.switchInspectTab = (tab) => {
      document.querySelectorAll('.inspect-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.inspect-view').forEach(v => v.classList.add('hidden'));

      const activeTab = document.querySelector(`.inspect-tab[data-tab="${tab}"]`);
      if (activeTab) activeTab.classList.add('active');

      const view = document.getElementById(`inspect-view-${tab}`);
      if (view) view.classList.remove('hidden');
    };

    // @ts-ignore
    window.copyInspectRaw = () => {
      const rawJson = JSON.stringify(entry.data, null, 4);
      navigator.clipboard.writeText(rawJson).then(() => {
        const btn = document.querySelector('.copy-raw-btn');
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = '✅ 복사됨!';
          btn.classList.add('success');
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('success');
          }, 2000);
        }
      });
    };

    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Add animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes modal-pop {
            from { opacity: 0; transform: scale(0.9) translateY(20px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
    `;
    document.head.appendChild(style);

    // Close on click outside
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });

  } catch (error) {
    console.error("Inspection failed:", error);
    alert("데이터 확인 실패: " + error.message);
  }
};

/**
 * Handles the Vault restore button click.
 * @param {Event} e - The click event.
 */
const handleVaultRestore = async (e) => {
  if (!confirm("현재 상태를 덮어쓰고 이 백업으로 복원하시겠습니까?")) return;

  // SAFETY FIX: Handle click on child elements inside button
  const btn = /** @type {HTMLButtonElement} */ (
    /** @type {HTMLElement} */ (e.target).closest('.vault-restore-btn')
  );
  if (!btn || !btn.dataset.backupId) {
    console.error("[VaultRestore] Button or backupId not found");
    return;
  }
  const backupId = Number(btn.dataset.backupId);

  if (isNaN(backupId) || backupId <= 0) {
    console.error("[VaultRestore] Invalid backupId:", btn.dataset.backupId);
    alert("유효하지 않은 백업 ID입니다.");
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = "복원 중...";

    const result = await restoreFromVault(backupId);

    if (result.success) {
      alert("성공적으로 복원되었습니다. 페이지를 새로고침합니다.");
      location.reload();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("Vault restore failed:", error);
    alert("복원 실패: " + error.message);
    btn.disabled = false;
    btn.textContent = "복원";
  }
};

/**
 * Loads the list of Vault backups.
 */
export const loadVaultBackups = async () => {
  const container = document.getElementById("vault-backup-list");
  if (!container) return;

  container.innerHTML = '<div class="backup-loading">불러오는 중...</div>';

  try {
    // Pre-load marker names for inspect feature
    loadAllMarkerNames().catch(console.warn);

    const backups = await getVaultHistory();
    renderVaultList(backups);
  } catch (error) {
    console.error("Failed to load vault backups:", error);
    container.innerHTML =
      '<div class="backup-error">백업 목록을 불러올 수 없습니다.</div>';
  }
};

/**
 * Initializes the Vault backup section.
 */
export const initVaultBackupSection = () => {
  // Inject Vault section if not exists
  const cloudSection = document.getElementById("cloud-backup-section");
  if (cloudSection && !document.getElementById("vault-backup-section")) {
    const vaultSection = document.createElement("div");
    vaultSection.id = "vault-backup-section";
    vaultSection.className = "settings-section";
    vaultSection.innerHTML = `
        <h3 style="display: flex; align-items: center; gap: 8px;">${ICONS.shield} 로컬 금고 (Vault)</h3>
        <p class="settings-desc">기기 내부에 안전하게 저장된 백업 기록입니다.</p>
        <div class="backup-controls">
            <button id="btn-vault-save" class="settings-btn primary">현재 상태 금고에 저장</button>
        </div>
        <div id="vault-backup-list" class="backup-list"></div>
    `;
    cloudSection.parentNode.insertBefore(vaultSection, cloudSection);

    // Init save button
    document.getElementById("btn-vault-save")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-vault-save");
      if (btn) btn.textContent = "저장 중...";
      await saveToVault("manual");
      await loadVaultBackups();
      if (btn) btn.textContent = "현재 상태 금고에 저장";
    });
  }

  const openSettingsBtn = document.getElementById("open-settings");
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", () => {
      setTimeout(() => {
        loadVaultBackups();
      }, 100);
    });
  }
};
