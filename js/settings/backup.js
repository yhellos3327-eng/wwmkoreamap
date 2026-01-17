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

const formatBackupDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
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
      } catch (e) {}
    }
  });
  return data;
};

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

const handleRestore = async (e) => {
  const btn = e.target;
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

export const initCloudBackupSection = () => {
  const cloudBackupSection = document.getElementById("cloud-backup-section");
  const saveBtn = document.getElementById("btn-cloud-backup-save");
  const openSettingsBtn = document.getElementById("open-settings");

  initIntegrityModal();
  initResultAlertModal();

  if (!cloudBackupSection) return;

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", () => {
      setTimeout(() => {
        if (isLoggedIn()) {
          cloudBackupSection.style.display = "block";
          loadCloudBackups();
        } else {
          cloudBackupSection.style.display = "none";
        }
      }, 100);
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
        saveBtn.disabled = true;
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
        saveBtn.disabled = false;
        saveBtn.innerHTML = SAVE_BUTTON_HTML;
      }
    });
  }
};
