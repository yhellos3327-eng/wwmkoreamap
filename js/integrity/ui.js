// @ts-check
/** @enum {string} */
const CHECK_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
};

const ICONS = {
  pending:
    "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3C/svg%3E",
  active:
    "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E",
  success:
    "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E",
  warning:
    "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E",
  error:
    "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='15' y1='9' x2='9' y2='15'/%3E%3Cline x1='9' y1='9' x2='15' y2='15'/%3E%3C/svg%3E",
};

let currentCheckData = null;
let onProceedCallback = null;

/**
 * Shows the integrity check modal.
 */
export const showModal = () => {
  const modal = document.getElementById("integrity-check-modal");
  if (modal) {
    modal.classList.remove("hidden");
  }
};

/**
 * Hides the integrity check modal.
 */
export const hideModal = () => {
  const modal = document.getElementById("integrity-check-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  resetModal();
};

/**
 * Resets the integrity check modal to its initial state.
 */
export const resetModal = () => {
  const steps = document.querySelectorAll("#integrity-steps .step");
  steps.forEach((step) => {
    step.className = "step";
    const icon = step.querySelector(".step-icon");
    if (icon) {
      icon.className = "step-icon pending";
      const maskEl = icon.querySelector(".icon-mask");
      if (maskEl) {
        /** @type {HTMLElement} */ (maskEl).style.setProperty(
          "--mask-url",
          `url("${ICONS.pending}")`,
        );
      }
    }
    const status = step.querySelector(".step-status");
    if (status) status.textContent = "";
  });

  const result = document.getElementById("integrity-result");
  if (result) result.classList.add("hidden");

  const proceedBtn = document.getElementById("integrity-proceed-btn");
  if (proceedBtn) /** @type {HTMLButtonElement} */ (proceedBtn).disabled = true;

  const statusEl = document.getElementById("integrity-status");
  if (statusEl) {
    statusEl.classList.remove("complete");
    statusEl.querySelector(".status-text").textContent = "검사 준비 중...";
  }

  const consoleLog = document.getElementById("integrity-console-log");
  if (consoleLog) {
    consoleLog.innerHTML =
      '<div class="console-line">> 검사 모듈 초기화 중...</div>';
  }
};

/**
 * Updates the status of a specific step in the integrity check.
 * @param {string} stepName
 * @param {string} status
 * @param {string} [statusText]
 */
export const updateStep = (stepName, status, statusText = "") => {
  const step = document.querySelector(
    `#integrity-steps .step[data-step="${stepName}"]`,
  );
  if (!step) return;

  step.className = `step ${status}`;

  const icon = step.querySelector(".step-icon");
  if (icon) {
    icon.className = `step-icon ${status}`;
    const maskEl = icon.querySelector(".icon-mask");
    if (maskEl) {
      /** @type {HTMLElement} */ (maskEl).style.setProperty(
        "--mask-url",
        `url("${ICONS[status] || ICONS.pending}")`,
      );
    }
  }

  const statusEl = step.querySelector(".step-status");
  if (statusEl) statusEl.textContent = statusText;
};

/**
 * Updates the overall status message of the integrity check.
 * @param {string} text
 * @param {boolean} [complete]
 */
export const updateStatus = (text, complete = false) => {
  const statusEl = document.getElementById("integrity-status");
  if (statusEl) {
    statusEl.classList.toggle("complete", complete);
    statusEl.querySelector(".status-text").textContent = text;
  }
};

/**
 * Shows the final result of the integrity check.
 * @param {string} type
 * @param {string} title
 * @param {string} desc
 * @param {string} [details]
 */
export const showResult = (type, title, desc, details = "") => {
  const result = document.getElementById("integrity-result");
  if (!result) return;

  result.classList.remove("hidden");

  const iconEl = result.querySelector(".result-icon");
  if (iconEl) {
    iconEl.className = `result-icon ${type}`;
    const maskEl = iconEl.querySelector(".icon-mask");
    if (maskEl) {
      /** @type {HTMLElement} */ (maskEl).style.setProperty(
        "--mask-url",
        `url("${ICONS[type]}")`,
      );
    }
  }

  const titleEl = result.querySelector(".result-title");
  if (titleEl) titleEl.textContent = title;

  const descEl = document.getElementById("result-desc");
  if (descEl) descEl.textContent = desc;

  const detailsEl = document.getElementById("result-details");
  if (detailsEl) detailsEl.innerHTML = details;
};

/**
 * Logs a message to the integrity check console.
 * @param {string} message
 * @param {string} [type]
 */
export const consoleLog = (message, type = "") => {
  const consoleEl = document.getElementById("integrity-console-log");
  if (!consoleEl) return;

  const line = document.createElement("div");
  line.className = `console-line ${type}`;
  line.textContent = message;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
};

/**
 * @param {any} data
 */
export const setCheckData = (data) => {
  currentCheckData = data;
};

/**
 * @returns {any}
 */
export const getCheckData = () => currentCheckData;

/**
 * @param {Function} callback
 */
export const setOnProceed = (callback) => {
  onProceedCallback = callback;
};

/**
 * Triggers the proceed callback with the current check data.
 */
export const triggerProceed = () => {
  if (onProceedCallback && currentCheckData) {
    hideModal();
    onProceedCallback(currentCheckData);
  }
};

/**
 * Enables the proceed button in the integrity check modal.
 */
export const enableProceedButton = () => {
  const proceedBtn = document.getElementById("integrity-proceed-btn");
  if (proceedBtn)
    /** @type {HTMLButtonElement} */ (proceedBtn).disabled = false;
};

const ALERT_ICONS = {
  success: `<div class="icon-mask" style="width: 32px; height: 32px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E&quot;);"></div>`,
  error: `<div class="icon-mask" style="width: 32px; height: 32px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='15' y1='9' x2='9' y2='15'/%3E%3Cline x1='9' y1='9' x2='15' y2='15'/%3E%3C/svg%3E&quot;);"></div>`,
  warning: `<div class="icon-mask" style="width: 32px; height: 32px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/%3E%3Cline x1='12' y1='9' x2='12' y2='13'/%3E%3Cline x1='12' y1='17' x2='12.01' y2='17'/%3E%3C/svg%3E&quot;);"></div>`,
  info: `<div class="icon-mask" style="width: 32px; height: 32px; --mask-url: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='16' x2='12' y2='12'/%3E%3Cline x1='12' y1='8' x2='12.01' y2='8'/%3E%3C/svg%3E&quot;);"></div>`,
};

let alertResolve = null;

/**
 * Shows a result alert modal.
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @param {boolean} [autoReload]
 * @returns {Promise<void>}
 */
export const showResultAlert = (type, title, message, autoReload = false) => {
  return new Promise((resolve) => {
    alertResolve = resolve;

    const modal = document.getElementById("result-alert-modal");
    const iconEl = document.getElementById("result-alert-icon");
    const titleEl = document.getElementById("result-alert-title");
    const messageEl = document.getElementById("result-alert-message");
    const confirmBtn = document.getElementById("result-alert-confirm");

    if (!modal) {
      alert(`${title}\n\n${message}`);
      if (autoReload) location.reload();
      resolve();
      return;
    }

    if (iconEl) {
      iconEl.className = `result-alert-icon ${type}`;
      iconEl.innerHTML = ALERT_ICONS[type] || ALERT_ICONS.info;
    }
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    if (confirmBtn) {
      const newBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

      newBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        if (autoReload) {
          location.reload();
        }
        resolve();
      });
    }
    modal.classList.remove("hidden");
  });
};

/**
 * Initializes the integrity check UI event listeners.
 */
export const initIntegrityUI = () => {
  const cancelBtn = document.getElementById("integrity-cancel-btn");
  const proceedBtn = document.getElementById("integrity-proceed-btn");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", hideModal);
  }

  if (proceedBtn) {
    proceedBtn.addEventListener("click", triggerProceed);
  }

  const alertModal = document.getElementById("result-alert-modal");
  if (alertModal) {
    alertModal.addEventListener("click", (e) => {
      if (e.target === alertModal) {
        alertModal.classList.add("hidden");
        if (alertResolve) {
          alertResolve();
          alertResolve = null;
        }
      }
    });
  }
};

export { CHECK_STATUS, ICONS };
