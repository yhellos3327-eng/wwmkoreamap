// @ts-check
import { loadAllData, clearDataCache } from "./data-loader.js";
import {
  validateBackupData,
  validateCompletedMarkers,
  validateFavorites,
  validateSettings,
  SEVERITY,
  STATUS,
  createResult,
} from "./validator.js";
import {
  showModal,
  hideModal,
  resetModal,
  updateStep,
  updateStatus,
  showResult,
  consoleLog,
  setCheckData,
  setOnProceed,
  enableProceedButton,
  CHECK_STATUS,
} from "./ui.js";

const CURRENT_DATA_VERSION = 1;

const DEFAULT_OPTIONS = {
  mode: "soft",
  autoClean: false,
  skipVersionCheck: false,
};

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a full integrity check on the provided data.
 * @param {any} data - The data to check.
 * @param {Function} onProceed - Callback when the user chooses to proceed.
 * @param {Object} [options] - Optional configuration.
 * @returns {Promise<any>} The integrity report.
 */
export const runIntegrityCheck = async (data, onProceed, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  setCheckData(data);
  setOnProceed(onProceed);

  showModal();
  resetModal();

  consoleLog("> 데이터 무결성 검사 시작", "highlight");
  consoleLog(`> 검사 시간: ${new Date().toLocaleTimeString("ko-KR")}`, "info");
  consoleLog(`> 검사 모드: ${opts.mode}`, "info");
  if (opts.autoClean) {
    consoleLog("> 자동 정리: 활성화됨", "info");
  }

  const externalData = await loadAllData({
    onLog: consoleLog,
  });

  const context = {
    validMarkerIds: externalData.allMarkerIds,
    validRegions: externalData.allRegionNames,
  };

  const report = createResult();
  report.mode = opts.mode;

  await delay(300);
  consoleLog("");
  consoleLog("> [STEP 1/4] JSON 구조 검사 시작...", "info");
  updateStatus("JSON 구조 검사 중...");
  updateStep("structure", CHECK_STATUS.ACTIVE);

  await delay(300);

  if (!data || typeof data !== "object") {
    consoleLog("  ✗ 데이터가 유효한 객체가 아닙니다", "error");
    updateStep("structure", CHECK_STATUS.ERROR, "실패");
    report.canRestore = false;
    report.steps.structure = { status: "failed", fatal: true };

    consoleLog("");
    consoleLog("> 검사 중단: 치명적 오류 발견", "error");
    updateStatus("검사 완료 - 치명적 오류", true);
    showResult(
      "error",
      "복원 불가",
      "데이터 형식에 치명적인 오류가 있습니다.",
      "",
    );

    return report;
  }

  consoleLog("  - typeof data: " + typeof data);
  consoleLog(
    "  - completedMarkers 존재: " + (data.completedMarkers !== undefined),
  );
  consoleLog("  - favorites 존재: " + (data.favorites !== undefined));
  consoleLog("  - settings 존재: " + (data.settings !== undefined));
  consoleLog("  ✓ 구조 검사 통과", "success");
  updateStep("structure", CHECK_STATUS.SUCCESS, "정상");
  report.steps.structure = { status: "passed" };

  report.steps.version = { status: "passed" };

  await delay(200);
  consoleLog("");

  consoleLog("> [STEP 2/4] 완료 목록 검증 중...", "info");
  updateStatus("완료 목록 검증 중...");
  updateStep("completed", CHECK_STATUS.ACTIVE);

  const completedResult = await runCompletedCheck(
    data.completedMarkers,
    context,
    opts,
  );
  report.steps.completed = completedResult;

  if (completedResult.skip) {
    consoleLog("  - 완료 목록이 없거나 배열이 아님", "info");
    updateStep("completed", CHECK_STATUS.SUCCESS, "건너뜀");
  } else if (completedResult.valid) {
    consoleLog(
      `  ✓ 완료 목록 검사 통과: ${completedResult.validCount}개`,
      "success",
    );
    updateStep(
      "completed",
      CHECK_STATUS.SUCCESS,
      `${completedResult.validCount}개`,
    );
  } else if (completedResult.severity === SEVERITY.WARNING) {
    consoleLog(
      `  ⚠ 완료 목록 검사 경고: ${completedResult.invalidCount}개 무효`,
      "warning",
    );
    updateStep(
      "completed",
      CHECK_STATUS.WARNING,
      `${completedResult.validCount}개 (${completedResult.invalidCount}개 경고)`,
    );
  } else {
    consoleLog(
      `  ✗ 완료 목록 검사 실패: ${completedResult.invalidCount}개 오류`,
      "error",
    );
    updateStep(
      "completed",
      CHECK_STATUS.ERROR,
      `${completedResult.invalidCount}개 오류`,
    );
    report.canRestore = false;
  }

  await delay(200);
  consoleLog("");

  consoleLog("> [STEP 3/4] 즐겨찾기 검증 중...", "info");
  updateStatus("즐겨찾기 검증 중...");
  updateStep("favorites", CHECK_STATUS.ACTIVE);

  const favoritesResult = await runFavoritesCheck(data.favorites, context);
  report.steps.favorites = favoritesResult;

  if (favoritesResult.skip) {
    consoleLog("  - 즐겨찾기가 없거나 배열이 아님", "info");
    updateStep("favorites", CHECK_STATUS.SUCCESS, "건너뜀");
  } else if (favoritesResult.valid) {
    consoleLog(
      `  ✓ 즐겨찾기 검사 통과: ${favoritesResult.validCount}개`,
      "success",
    );
    updateStep(
      "favorites",
      CHECK_STATUS.SUCCESS,
      `${favoritesResult.validCount}개`,
    );
  } else {
    consoleLog(
      `  ⚠ 즐겨찾기 검사 경고: ${favoritesResult.invalidCount}개 무효`,
      "warning",
    );
    updateStep(
      "favorites",
      CHECK_STATUS.WARNING,
      `${favoritesResult.validCount}개 (경고)`,
    );
  }

  await delay(200);
  consoleLog("");

  consoleLog("> [STEP 4/4] 설정 데이터 검증 중...", "info");
  updateStatus("설정 데이터 검증 중...");
  updateStep("settings", CHECK_STATUS.ACTIVE);

  const settingsResult = await runSettingsCheck(
    data.settings,
    context,
    opts,
    data,
  );
  report.steps.settings = settingsResult;

  if (settingsResult.skip) {
    consoleLog("  - 설정 데이터 없음", "info");
    updateStep("settings", CHECK_STATUS.SUCCESS, "건너뜀");
  } else if (settingsResult.valid) {
    consoleLog(`  ✓ 설정 검사 통과: ${settingsResult.count}개 항목`, "success");
    updateStep(
      "settings",
      CHECK_STATUS.SUCCESS,
      `${settingsResult.count}개 항목`,
    );
  } else if (opts.mode === "soft") {
    consoleLog(
      `  ⚠ 설정 검사 경고: ${settingsResult.invalidCount}개 문제`,
      "warning",
    );
    updateStep(
      "settings",
      CHECK_STATUS.WARNING,
      `${settingsResult.invalidCount}개 경고`,
    );
  } else {
    consoleLog(
      `  ✗ 설정 검사 실패: ${settingsResult.invalidCount}개 오류`,
      "error",
    );
    updateStep(
      "settings",
      CHECK_STATUS.ERROR,
      `${settingsResult.invalidCount}개 오류`,
    );
    report.canRestore = false;
  }

  if (settingsResult.cleaned && settingsResult.cleaned.length > 0) {
    report.autoCleanApplied = true;
    report.cleaned = settingsResult.cleaned;
    consoleLog(
      `> 자동 정리: ${settingsResult.cleaned.length}개 항목 정리됨`,
      "warning",
    );
  }

  await delay(300);
  consoleLog("");
  consoleLog("━".repeat(40), "info");

  if (!report.canRestore) {
    consoleLog("> 최종 결과: 복원 불가", "error");
    updateStatus("검사 완료 - 오류 발견", true);
    showResult(
      "error",
      "복원 불가",
      "데이터에 심각한 오류가 있어 복원할 수 없습니다.",
      collectIssues(report),
    );
  } else if (hasWarnings(report)) {
    consoleLog("> 최종 결과: 경고와 함께 복원 가능", "warning");
    updateStatus("검사 완료 - 경고 있음", true);
    showResult(
      "warning",
      "경고와 함께 복원 가능",
      `완료 ${completedResult.validCount || 0}개, 즐겨찾기 ${favoritesResult.validCount || 0}개`,
      report.autoCleanApplied
        ? "일부 문제 데이터가 자동 정리되었습니다."
        : "일부 데이터에 문제가 있을 수 있지만 복원은 가능합니다.",
    );
    enableProceedButton();
  } else {
    consoleLog("> 최종 결과: 모든 검사 통과 ✓", "success");
    updateStatus("검사 완료 - 이상 없음", true);
    showResult(
      "success",
      "검사 통과",
      `완료 ${completedResult.validCount || 0}개, 즐겨찾기 ${favoritesResult.validCount || 0}개`,
      "모든 데이터가 정상입니다. 안전하게 복원할 수 있습니다.",
    );
    enableProceedButton();
  }

  consoleLog("> 검사 종료: " + new Date().toLocaleTimeString("ko-KR"), "info");

  return report;
};

/**
 * @param {any[]} markers
 * @param {any} context
 * @param {any} opts
 * @returns {Promise<any>}
 */
const runCompletedCheck = async (markers, context, opts) => {
  if (!markers || !Array.isArray(markers)) {
    return { skip: true, validCount: 0, invalidCount: 0 };
  }

  const hasMarkerData = context.validMarkerIds?.size > 0;
  if (!hasMarkerData) {
    consoleLog(
      "  ⚠ 마커 데이터가 로드되지 않아 실존 여부 검사를 건너뜁니다.",
      "warning",
    );
  }

  const total = markers.length;
  consoleLog(`  - 총 ${total}개 항목 검사 시작...`);

  let validCount = 0;
  let invalidCount = 0;
  const issues = [];

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    let isValid = false;
    let markerId = "(unknown)";
    let errorMsg = "";

    if (
      typeof marker === "number" ||
      (typeof marker === "string" && /^\d+$/.test(marker))
    ) {
      markerId = String(marker);
      isValid = !hasMarkerData || context.validMarkerIds.has(markerId);
      if (!isValid) errorMsg = "존재하지 않는 마커 ID";
    } else if (
      marker &&
      typeof marker === "object" &&
      marker.id !== undefined
    ) {
      markerId = String(marker.id);
      if (!/^\d+$/.test(markerId)) {
        errorMsg = "ID가 유효한 숫자가 아님";
      } else {
        isValid = !hasMarkerData || context.validMarkerIds.has(markerId);
        if (!isValid) errorMsg = "존재하지 않는 마커 ID";
      }
    } else {
      errorMsg = "잘못된 형식";
    }

    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
      if (issues.length < 3) {
        issues.push(`항목 ${i + 1} (ID: ${markerId}): ${errorMsg}`);
      }
    }

    if (i < 5 || i >= total - 3 || i % 50 === 0) {
      const status = isValid ? "✓" : "✗";
      const statusClass = isValid ? "success" : "error";
      const msg = isValid ? "" : ` (${errorMsg})`;
      consoleLog(
        `    [${String(i + 1).padStart(4, "0")}] ID: ${markerId} ${status}${msg}`,
        statusClass,
      );
    } else if (i === 5) {
      consoleLog(`    ... (${total - 8}개 항목 검사 중)`, "info");
    }

    if (i % 20 === 0) await delay(10);
  }

  consoleLog(`  - 검사 완료: 유효 ${validCount}개 / 무효 ${invalidCount}개`);

  let valid = invalidCount === 0;
  let severity = null;

  if (invalidCount > 0) {
    const errorRate = invalidCount / (validCount + invalidCount);
    if (opts.mode === "strict" || errorRate > 0.1) {
      severity = SEVERITY.ERROR;
    } else {
      severity = SEVERITY.WARNING;
      valid = true;
    }
  }

  return { valid, validCount, invalidCount, issues, severity };
};

/**
 * @param {any[]} favorites
 * @param {any} context
 * @returns {Promise<any>}
 */
const runFavoritesCheck = async (favorites, context) => {
  if (!favorites || !Array.isArray(favorites)) {
    return { skip: true, validCount: 0, invalidCount: 0 };
  }

  const hasMarkerData = context.validMarkerIds?.size > 0;
  const total = favorites.length;

  consoleLog(`  - 총 ${total}개 항목 검사 시작...`);

  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < favorites.length; i++) {
    const fav = favorites[i];
    let isValid = false;
    let favId = "(unknown)";
    let errorMsg = "";

    if (
      typeof fav === "number" ||
      (typeof fav === "string" && /^\d+$/.test(fav))
    ) {
      favId = String(fav);
      isValid = !hasMarkerData || context.validMarkerIds.has(favId);
      if (!isValid) errorMsg = "존재하지 않는 마커 ID";
    } else if (fav && typeof fav === "object" && fav.id !== undefined) {
      favId = String(fav.id);
      isValid = !hasMarkerData || context.validMarkerIds.has(favId);
      if (!isValid) errorMsg = "존재하지 않는 마커 ID";
    } else {
      errorMsg = "잘못된 형식";
    }

    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    const status = isValid ? "✓" : "✗";
    const statusClass = isValid ? "success" : "error";
    const msg = isValid ? "" : ` (${errorMsg})`;
    consoleLog(
      `    [${String(i + 1).padStart(2, "0")}] ID: ${favId} ${status}${msg}`,
      statusClass,
    );

    await delay(30);
  }

  consoleLog(`  - 검사 완료: ${validCount}개 유효`);

  return {
    valid: invalidCount === 0,
    validCount,
    invalidCount,
    severity: invalidCount > 0 ? SEVERITY.WARNING : null,
  };
};

/**
 * @param {any} settings
 * @param {any} context
 * @param {any} opts
 * @param {any} data
 * @returns {Promise<any>}
 */
const runSettingsCheck = async (settings, context, opts, data) => {
  if (!settings || typeof settings !== "object") {
    return { skip: true, count: 0, invalidCount: 0 };
  }

  const ignoredKeys = ["_updatedAt"];
  const keys = Object.keys(settings).filter((k) => !ignoredKeys.includes(k));
  const hasRegionData = context.validRegions?.size > 0;

  consoleLog(`  - 총 ${keys.length}개 설정 항목 정밀 검사...`);

  let invalidCount = 0;
  const issues = [];
  const cleaned = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = settings[key];
    let isValid = true;
    let msg = "";

    if (key.startsWith("activeCats")) {
      if (!Array.isArray(value)) {
        isValid = false;
        msg = "배열 형식이 아님";
      } else {
        const invalidItems = value.filter(
          (item) => typeof item !== "string" || !/^\d+$/.test(item),
        );
        if (invalidItems.length > 0) {
          isValid = false;
          msg = `유효하지 않은 ID 포함 (${invalidItems[0]} 등 ${invalidItems.length}개)`;
        }
      }
    } else if (key.startsWith("activeRegs")) {
      if (!Array.isArray(value)) {
        isValid = false;
        msg = "배열 형식이 아님";
      } else if (hasRegionData) {
        const invalidRegions = value.filter(
          (r) => typeof r !== "string" || !context.validRegions.has(r),
        );

        if (invalidRegions.length > 0) {
          if (opts.autoClean) {
            const validRegions = value.filter(
              (r) => typeof r === "string" && context.validRegions.has(r),
            );
            settings[key] = validRegions;
            cleaned.push({
              key,
              removed: invalidRegions,
              remaining: validRegions.length,
            });
            consoleLog(
              `    [${key}]: ${invalidRegions.length}개 유효하지 않은 지역 자동 제거됨`,
              "warning",
            );
            msg = `자동 정리됨: ${invalidRegions.length}개 제거`;
          } else {
            isValid = false;
            const preview = invalidRegions.slice(0, 5).join(", ");
            const suffix =
              invalidRegions.length > 5
                ? ` 외 ${invalidRegions.length - 5}개`
                : "";
            msg = `존재하지 않는 지역 포함: ${preview}${suffix}`;
          }
        }
      }
    } else if (key === "wwm_cleanup_last_run" || key.includes("last_run")) {
      if (typeof value !== "number" || isNaN(value)) {
        isValid = false;
        msg = "유효한 숫자가 아님";
      }
    } else if (
      [
        "showAd",
        "showComments",
        "hideCompleted",
        "enableClustering",
        "closeOnComplete",
      ].includes(key)
    ) {
      if (typeof value !== "boolean") {
        isValid = false;
        msg = "불리언(true/false) 값이 아님";
      }
    }

    const displayValue =
      typeof value === "object"
        ? JSON.stringify(value).slice(0, 30) + "..."
        : String(value).slice(0, 20);

    if (isValid) {
      consoleLog(`    [${key}]: ${displayValue} ✓`, "success");
    } else {
      consoleLog(`    [${key}]: ${displayValue} ✗ (${msg})`, "error");
      issues.push(`설정 [${key}]: ${msg}`);
      invalidCount++;
    }

    await delay(20);
  }

  if (invalidCount > 0) {
    consoleLog(`  - 검사 완료: ${invalidCount}개 항목 오류 발견`, "error");
  } else {
    consoleLog(`  - 검사 완료: ${keys.length}개 항목 정상`);
  }

  return {
    valid: invalidCount === 0,
    count: keys.length,
    invalidCount,
    issues,
    cleaned,
    severity:
      invalidCount > 0
        ? opts.mode === "strict"
          ? SEVERITY.ERROR
          : SEVERITY.WARNING
        : null,
  };
};

/**
 * Checks if the report has any warnings.
 * @param {any} report - The integrity report.
 * @returns {boolean} True if there are warnings.
 */
const hasWarnings = (report) => {
  return Object.values(report.steps).some(
    (step) => step.severity === SEVERITY.WARNING || step.status === "warning",
  );
};

/**
 * Collects issues from the report.
 * @param {any} report - The integrity report.
 * @returns {string} The collected issues formatted as HTML.
 */
const collectIssues = (report) => {
  const issues = [];
  Object.values(report.steps).forEach((step) => {
    if (step.issues) issues.push(...step.issues);
  });
  return issues
    .slice(0, 10)
    .map((i) => `• ${i}`)
    .join("<br>");
};

/**
 * Performs a quick validation of the data structure.
 * @param {any} data
 * @returns {{valid: boolean, issues: string[]}}
 */
export const quickValidate = (data) => {
  const result = {
    valid: true,
    issues: [],
  };

  if (!data || typeof data !== "object") {
    result.valid = false;
    result.issues.push("데이터가 유효한 객체가 아님");
    return result;
  }

  if (
    data.completedMarkers !== undefined &&
    !Array.isArray(data.completedMarkers)
  ) {
    result.valid = false;
    result.issues.push("completedMarkers가 배열이 아님");
  }

  if (data.favorites !== undefined && !Array.isArray(data.favorites)) {
    result.valid = false;
    result.issues.push("favorites가 배열이 아님");
  }

  if (
    data.settings !== undefined &&
    (typeof data.settings !== "object" || data.settings === null)
  ) {
    result.valid = false;
    result.issues.push("settings가 유효한 객체가 아님");
  }

  return result;
};

export { clearDataCache, SEVERITY };
