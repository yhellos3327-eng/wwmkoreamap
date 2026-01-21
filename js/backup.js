// @ts-check
/**
 * @fileoverview Backup module - handles data backup and restore functionality.
 * @module backup
 */

import { runIntegrityCheck, showResultAlert } from "./integrity.js";

/**
 * Saves current localStorage data as a JSON backup file.
 */
export const saveBackup = () => {
  try {
    const data = { ...localStorage };
    if (Object.keys(data).length === 0) {
      showResultAlert(
        "warning",
        "저장할 데이터 없음",
        "저장할 데이터가 없습니다.",
      );
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `map_data_backup_${dateStr}.json`;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showResultAlert("success", "백업 완료", "파일로 데이터가 저장되었습니다.");
  } catch (err) {
    console.error("백업 실패:", err);
    showResultAlert(
      "error",
      "백업 실패",
      "데이터 저장 중 오류가 발생했습니다.",
    );
  }
};

/**
 * Loads backup from a local file with integrity checking.
 * @param {File|undefined} file - The backup file to load.
 */
export const loadBackup = (file) => {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (event) => {
    try {
      const fileContent = /** @type {string} */ (event.target?.result);
      const parsedData = JSON.parse(fileContent);

      if (typeof parsedData !== "object" || parsedData === null) {
        throw new Error("잘못된 JSON 형식");
      }

      const dataForCheck = convertLocalStorageToSyncFormat(parsedData);

      runIntegrityCheck(dataForCheck, async () => {
        localStorage.clear();
        for (const key in parsedData) {
          if (Object.prototype.hasOwnProperty.call(parsedData, key)) {
            localStorage.setItem(key, parsedData[key]);
          }
        }
        localStorage.setItem("wwm_backup_restored", Date.now().toString());

        await showResultAlert(
          "success",
          "복원 완료",
          "데이터 복구가 완료되었습니다. 페이지를 새로고침합니다.",
          true,
        );
      });
    } catch (err) {
      console.error("복구 실패:", err);
      showResultAlert(
        "error",
        "복원 실패",
        "파일을 읽는 데 실패했습니다. 올바른 백업 파일인지 확인해 주세요.",
      );
    }
  };
  reader.readAsText(file);
};

/**
 * Converts localStorage format backup data to sync format for integrity checking.
 * @param {Object<string, string>} localStorageData - localStorage format data.
 * @returns {{completedMarkers: any[], favorites: any[], settings: Object}} Sync format data.
 */
const convertLocalStorageToSyncFormat = (localStorageData) => {
  const result = {
    completedMarkers: /** @type {any[]} */ ([]),
    favorites: /** @type {any[]} */ ([]),
    settings: /** @type {Object} */ ({}),
  };

  if (localStorageData.wwm_completed) {
    try {
      const completed = JSON.parse(localStorageData.wwm_completed);
      if (Array.isArray(completed)) {
        result.completedMarkers = completed;
      } else if (typeof completed === "object") {
        result.completedMarkers = Object.keys(completed);
      }
    } catch (e) {
      throw new Error("완료 목록 데이터(wwm_completed)가 손상되었습니다.");
    }
  }

  if (localStorageData.wwm_favorites) {
    try {
      const favorites = JSON.parse(localStorageData.wwm_favorites);
      if (Array.isArray(favorites)) {
        result.favorites = favorites;
      }
    } catch (e) {
      throw new Error("즐겨찾기 데이터(wwm_favorites)가 손상되었습니다.");
    }
  }

  const settingKeys = [
    "wwm_settings",
    "wwm_show_ad",
    "wwm_hide_completed",
    "wwm_enable_clustering",
    "wwm_show_comments",
    "wwm_close_on_complete",
    "wwm_gpu_setting",
    "wwm_cleanup_last_run",
    "wwm_region_color",
    "wwm_region_fill_color",
    "wwm_active_cats_qinghe",
    "wwm_active_cats_kaifeng",
    "wwm_active_regs_qinghe",
    "wwm_active_regs_kaifeng",
  ];

  settingKeys.forEach((key) => {
    if (localStorageData[key]) {
      const shortKey = key.replace(/^wwm_/, "");
      let targetKey = shortKey;
      if (key === "wwm_active_cats_qinghe") targetKey = "activeCatsQinghe";
      else if (key === "wwm_active_cats_kaifeng")
        targetKey = "activeCatsKaifeng";
      else if (key === "wwm_active_regs_qinghe") targetKey = "activeRegsQinghe";
      else if (key === "wwm_active_regs_kaifeng")
        targetKey = "activeRegsKaifeng";
      else if (key === "wwm_show_ad") targetKey = "showAd";
      else if (key === "wwm_hide_completed") targetKey = "hideCompleted";
      else if (key === "wwm_enable_clustering") targetKey = "enableClustering";
      else if (key === "wwm_show_comments") targetKey = "showComments";
      else if (key === "wwm_close_on_complete") targetKey = "closeOnComplete";
      else if (key === "wwm_gpu_setting") targetKey = "gpuMode";
      else if (key === "wwm_region_color") targetKey = "regionColor";
      else if (key === "wwm_region_fill_color") targetKey = "regionFillColor";

      try {
        result.settings[targetKey] = JSON.parse(localStorageData[key]);
      } catch {
        result.settings[targetKey] = localStorageData[key];
      }
    }
  });

  return result;
};

/**
 * Initializes backup button event listeners.
 */
export const initBackupButtons = () => {
  const saveBtn = document.getElementById("btn-backup-save");
  const loadBtn = document.getElementById("btn-backup-load");
  const fileInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById("inp-backup-file")
  );

  if (!saveBtn || !loadBtn || !fileInput) return;

  saveBtn.addEventListener("click", saveBackup);

  loadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    loadBackup(target.files?.[0]);
    target.value = "";
  });
};
