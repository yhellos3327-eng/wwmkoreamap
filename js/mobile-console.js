/**
 * 모바일 콘솔 모듈 - 모바일 기기에서의 디버깅을 위한 시각적 콘솔을 제공합니다.
 * 'debug' URL 매개변수가 있을 때 활성화됩니다.
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

  function clearLogs() {
    logs.length = 0;
    body.innerHTML = "";
  }

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
