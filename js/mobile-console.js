/**
 * @fileoverview Mobile console module - provides a visual console for debugging on mobile devices.
 * Activates when 'debug' URL parameter is present.
 * @module mobile-console
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has("debug")) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "css/mobile-console.css";
  document.head.appendChild(link);

  const logs = [];
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  let container, body, toggleBtn;
  let isMinimized = false;

  /**
   * Create and inject the mobile console UI into the document and wire its controls and event handlers.
   *
   * Initializes the console container and toggle button, attaches the console body reference, and sets up user interactions for header toggling, copy, clear, minimize, and filter buttons.
   */
  function createUI() {
    container = document.createElement("div");
    container.className = "mobile-console-container";
    container.innerHTML = `
            <div class="mobile-console-header">
                <div class="mobile-console-title">🔧 Mobile Console</div>
                <div class="mobile-console-controls">
                    <button class="mobile-console-btn" id="console-copy">Copy</button>
                    <button class="mobile-console-btn" id="console-clear">Clear</button>
                    <button class="mobile-console-btn" id="console-minimize">_</button>
                </div>
            </div>
            <div class="mobile-console-filter-bar">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="log">Log</button>
                <button class="filter-btn" data-filter="info">Info</button>
                <button class="filter-btn" data-filter="warn">Warn (Yellow)</button>
                <button class="filter-btn" data-filter="error">Error (Red)</button>
            </div>
            <div class="mobile-console-body"></div>
        `;

    body = container.querySelector(".mobile-console-body");

    toggleBtn = document.createElement("button");
    toggleBtn.className = "mobile-console-toggle hidden";
    toggleBtn.innerHTML = "🛠️";

    document.body.appendChild(container);
    document.body.appendChild(toggleBtn);

    container.querySelector(".mobile-console-header").onclick = (e) => {
      if (e.target.tagName !== "BUTTON") {
        toggleMinimize();
      }
    };

    document.getElementById("console-copy").onclick = (e) => {
      e.stopPropagation();
      copyLogs();
    };

    document.getElementById("console-clear").onclick = (e) => {
      e.stopPropagation();
      clearLogs();
    };

    document.getElementById("console-minimize").onclick = (e) => {
      e.stopPropagation();
      toggleMinimize();
    };

    toggleBtn.onclick = () => {
      toggleMinimize();
    };

    container.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const filter = btn.dataset.filter;
        applyFilter(filter);

        container
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      };
    });
  }

  /**
   * Show or hide console log entries to match the selected filter.
   * Sets each `.console-log-item` element's display to `flex` when it matches the filter, otherwise hides it.
   * @param {string} filter - The filter to apply: `"all"` or a log type (e.g. `"log"`, `"info"`, `"warn"`, `"error"`).
  function applyFilter(filter) {
    const items = body.querySelectorAll(".console-log-item");
    items.forEach((item) => {
      if (filter === "all" || item.classList.contains(filter)) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  }

  /**
   * Toggle the console UI between minimized and expanded states.
   *
   * Updates the internal minimized flag, adds or removes the "minimized" class on the console container,
   * and shows or hides the toggle button by adding or removing the "hidden" class.
   */
  function toggleMinimize() {
    isMinimized = !isMinimized;
    if (isMinimized) {
      container.classList.add("minimized");
      toggleBtn.classList.remove("hidden");
    } else {
      container.classList.remove("minimized");
      toggleBtn.classList.add("hidden");
    }
  }

  /**
   * Remove all captured logs and clear the on-screen console.
   *
   * Empties the internal logs array and removes all log entries from the UI body element.
   */
  function clearLogs() {
    logs.length = 0;
    body.innerHTML = "";
  }

  /**
   * Copy collected console logs to the clipboard.
   *
   * Each log becomes a line in the clipboard in the format: `[time] TYPE: message`.
   * On success, shows a user alert indicating the logs were copied; on failure, logs an error to the original console.
   */
  function copyLogs() {
    const text = logs
      .map((l) => `[${l.time}] ${l.type.toUpperCase()}: ${l.message}`)
      .join("\n");
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Logs copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy logs:", err);
      });
  }

  /**
   * Format an array of values into a single human-readable string suitable for display in the console UI.
   * @param {any[]} args - Values to format. Error objects are expanded to `Name: message` plus stack; plain objects are JSON-stringified with two-space indentation when possible; other values are converted to strings.
   * @returns {string} A single string with each argument's formatted representation separated by spaces.
  function formatArgs(args) {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}\n${arg.stack}`;
        }
        if (typeof arg === "object" && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");
  }

  /**
   * Record a console entry and (if the UI is present) render it in the console panel.
   *
   * Adds a timestamped log entry to the internal logs array and, when the UI body exists,
   * creates and appends a corresponding DOM item (with time and formatted message),
   * respects the current filter by hiding non-matching types, and scrolls the body to the bottom.
   *
   * @param {string} type - Log severity/type (e.g., "log", "info", "warn", "error").
   * @param {Array|IArguments} args - Original arguments passed to the console method; will be formatted into a display message.
   */
  function addLog(type, args) {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    const message = formatArgs(args);

    const logItem = { type, time, message };
    logs.push(logItem);

    if (body) {
      const div = document.createElement("div");
      div.className = `console-log-item ${type}`;
      div.innerHTML = `<span class="time">[${time}]</span> <span class="message">${message}</span>`;

      const activeFilterBtn = container.querySelector(".filter-btn.active");
      const activeFilter = activeFilterBtn
        ? activeFilterBtn.dataset.filter
        : "all";
      if (activeFilter !== "all" && activeFilter !== type) {
        div.style.display = "none";
      }

      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }
  }

  console.log = function (...args) {
    originalConsole.log.apply(console, args);
    addLog("log", args);
  };

  console.error = function (...args) {
    originalConsole.error.apply(console, args);
    addLog("error", args);
  };

  console.warn = function (...args) {
    originalConsole.warn.apply(console, args);
    addLog("warn", args);
  };

  console.info = function (...args) {
    originalConsole.info.apply(console, args);
    addLog("info", args);
  };

  window.onerror = function (msg, url, lineNo, columnNo, error) {
    addLog("error", [`Global Error: ${msg}\nAt: ${url}:${lineNo}:${columnNo}`]);
    return false;
  };

  window.onunhandledrejection = function (event) {
    addLog("error", [`Unhandled Promise Rejection: ${event.reason}`]);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createUI);
  } else {
    createUI();
  }

  console.log("Mobile Console Initialized. Debug mode active.");
})();