// @ts-check

let tooltipTimeout = null;
let lastTooltipTime = 0;
const TOOLTIP_THROTTLE_MS = 5000;

/**
 * 동기화 툴팁 요소가 없으면 생성합니다.
 * @returns {HTMLElement} 툴팁 요소.
 */
const createSyncTooltip = () => {
  let tooltip = document.getElementById("sync-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "sync-tooltip";
    tooltip.innerHTML = `
            <span class="sync-spinner">⟳</span>
            <span class="sync-text">동기화중...</span>
        `;
    tooltip.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(0);
            background: var(--bg-panel);
            backdrop-filter: var(--glass-blur) saturate(180%);
            -webkit-backdrop-filter: var(--glass-blur) saturate(180%);
            color: var(--text-main);
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            display: none;
            align-items: center;
            gap: 12px;
            box-shadow: var(--glass-shadow);
            border: 1px solid var(--glass-border);
            transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
        `;

    const style = document.createElement("style");
    style.textContent = `
            @keyframes sync-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            #sync-tooltip .sync-spinner {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                animation: sync-spin 1s linear infinite;
                font-size: 18px;
                color: var(--accent);
            }
            #sync-tooltip.sync-success { border-color: rgba(50, 215, 75, 0.4); }
            #sync-tooltip.sync-success .sync-spinner { color: var(--success); }
            
            #sync-tooltip.sync-error { border-color: rgba(255, 59, 48, 0.4); }
            #sync-tooltip.sync-error .sync-spinner { color: #ff3b30; }
            
            #sync-tooltip.sync-update { border-color: rgba(0, 122, 255, 0.4); }
            #sync-tooltip.sync-update .sync-spinner { color: #007aff; }

            #sync-tooltip.hidden {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
                pointer-events: none;
            }
        `;
    document.head.appendChild(style);
    document.body.appendChild(tooltip);
  }
  return tooltip;
};

/**
 * 메시지와 함께 동기화 툴팁을 표시합니다.
 * @param {string} [message="동기화중..."] - 표시할 메시지.
 * @param {string} [type="syncing"] - 툴팁 유형 ('syncing', 'success', 'error', 'update').
 */
export const showSyncTooltip = (message = "동기화중...", type = "syncing") => {
  const tooltip = createSyncTooltip();
  const spinner = /** @type {HTMLElement} */ (
    tooltip.querySelector(".sync-spinner")
  );
  const text = /** @type {HTMLElement} */ (tooltip.querySelector(".sync-text"));

  // 성공 메시지 조절 (스로틀링)
  if (type === "success") {
    const now = Date.now();
    if (now - lastTooltipTime < TOOLTIP_THROTTLE_MS) {
      return; // 너무 빈번한 업데이트 건너뜀
    }
    lastTooltipTime = now;
  }

  tooltip.classList.remove(
    "hidden",
    "sync-success",
    "sync-error",
    "sync-update",
  );

  if (type === "success") {
    tooltip.classList.add("sync-success");
    spinner.textContent = "✓";
    spinner.style.animation = "none";
  } else if (type === "error") {
    tooltip.classList.add("sync-error");
    spinner.textContent = "✕";
    spinner.style.animation = "none";
  } else if (type === "update") {
    tooltip.classList.add("sync-update");
    spinner.textContent = "↻";
    spinner.style.animation = "none";
  } else {
    spinner.textContent = "⟳";
    spinner.style.animation = "sync-spin 1s linear infinite";
  }

  text.textContent = message;
  tooltip.style.display = "flex";

  // 리플로우 강제 실행
  tooltip.offsetHeight;
  tooltip.classList.remove("hidden");

  // 기존 타임아웃이 있으면 초기화
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
};

/**
 * 일정 시간 후 동기화 툴팁을 숨깁니다.
 * @param {number} [delay=0] - 지연 시간 (밀리초).
 */
export const hideSyncTooltip = (delay = 0) => {
  tooltipTimeout = setTimeout(() => {
    const tooltip = document.getElementById("sync-tooltip");
    if (tooltip) {
      tooltip.classList.add("hidden");
      setTimeout(() => {
        if (tooltip.classList.contains("hidden")) {
          tooltip.style.display = "none";
        }
      }, 400);
    }
  }, delay);
};

/**
 * 동기화 토스트 알림을 표시합니다.
 * @param {string} message - 표시할 메시지.
 * @param {string} [type="info"] - 토스트 유형 ('info', 'success', 'update').
 */
export const showSyncToast = (message, type = "info") => {
  let toast = document.getElementById("sync-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "sync-toast";
    toast.style.cssText = `
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            background: var(--bg-panel);
            backdrop-filter: var(--glass-blur) saturate(180%);
            -webkit-backdrop-filter: var(--glass-blur) saturate(180%);
            color: var(--text-main);
            padding: 14px 24px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
            box-shadow: var(--glass-shadow);
            border: 1px solid var(--glass-border);
            max-width: 90vw;
            width: max-content;
            text-align: center;
        `;
    document.body.appendChild(toast);
  }

  if (type === "success") toast.style.borderColor = "rgba(50, 215, 75, 0.4)";
  else if (type === "update")
    toast.style.borderColor = "rgba(0, 122, 255, 0.4)";
  else toast.style.borderColor = "var(--glass-border)";

  toast.textContent = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(-20px)";
  }, 3000);
};

/**
 * 데이터 유실 경고 모달을 표시하고 사용자의 선택을 반환합니다.
 * @param {number} localCount - 로컬 항목 수.
 * @param {number} cloudCount - 클라우드 항목 수.
 * @returns {Promise<'restore'|'overwrite'|'cancel'>} 사용자의 선택.
 */
export const showDataLossWarning = (localCount, cloudCount) => {
  return new Promise((resolve) => {
    // 이미 있으면 제거
    const existing = document.getElementById("sync-warning-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "sync-warning-modal";
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    modal.innerHTML = `
        <div style="
            background: var(--bg-panel, #1a1a1a);
            border: 1px solid var(--glass-border, #333);
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            text-align: center;
            color: var(--text-main, #fff);
        ">
            <div style="margin-bottom: 16px; color: #ffcc00; display: flex; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
            </div>
            <h3 style="margin: 0 0 12px 0; font-size: 1.2rem; font-weight: 700;">데이터 유실 경고</h3>
            <p style="margin: 0 0 24px 0; font-size: 0.95rem; line-height: 1.5; color: var(--text-muted, #aaa);">
                로컬 데이터가 비어있습니다 (${localCount}개).<br>
                반면 클라우드에는 <b>${cloudCount}개</b>의 데이터가 있습니다.<br><br>
                정말로 모든 데이터를 삭제하시겠습니까?<br>
                아니면 클라우드 데이터를 복구하시겠습니까?
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="btn-restore" style="
                    background: #007aff; border: none; padding: 12px; border-radius: 8px;
                    color: white; font-weight: 600; cursor: pointer; font-size: 1rem;
                ">
                    클라우드 데이터 복구 (권장)
                </button>
                <button id="btn-overwrite" style="
                    background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.3); 
                    padding: 12px; border-radius: 8px;
                    color: #ff3b30; font-weight: 600; cursor: pointer; font-size: 0.9rem;
                ">
                    아니요, 전부 삭제합니다 (초기화)
                </button>
                <button id="btn-cancel" style="
                    background: transparent; border: none; padding: 8px; 
                    color: var(--text-muted, #888); cursor: pointer; font-size: 0.9rem;
                    margin-top: 4px;
                ">
                    나중에 결정 (취소)
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const cleanup = () => modal.remove();

    modal.querySelector("#btn-restore").addEventListener("click", () => {
      cleanup();
      resolve('restore');
    });

    modal.querySelector("#btn-overwrite").addEventListener("click", () => {
      cleanup();
      resolve('overwrite');
    });

    modal.querySelector("#btn-cancel").addEventListener("click", () => {
      cleanup();
      resolve('cancel');
    });
  });
};
