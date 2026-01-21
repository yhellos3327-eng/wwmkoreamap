// @ts-check
let lastMode = null;

export const showRenderModeIndicator = (mode, force = false) => {
  if (!force && lastMode === mode) return;
  lastMode = mode;

  const existing = document.getElementById("render-mode-indicator");
  if (existing) existing.remove();

  const indicator = document.createElement("div");
  indicator.id = "render-mode-indicator";
  indicator.innerHTML =
    mode === "GPU"
      ? "🚀 <strong>GPU MODE</strong> (WebGL)"
      : "🖥️ <strong>CPU MODE</strong> (Leaflet)";
  indicator.style.cssText = `
        position: fixed;
        top: 60px;
        right: 10px;
        background: ${mode === "GPU" ? "linear-gradient(135deg, #4CAF50, #2E7D32)" : "linear-gradient(135deg, #2196F3, #1565C0)"};
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-family: system-ui, sans-serif;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        pointer-events: none;
        animation: fadeInScale 0.3s ease;
    `;

  if (!document.getElementById("render-mode-style")) {
    const style = document.createElement("style");
    style.id = "render-mode-style";
    style.textContent = `
            @keyframes fadeInScale {
                from { opacity: 0; transform: scale(0.8); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
    document.head.appendChild(style);
  }

  document.body.appendChild(indicator);

  setTimeout(() => {
    indicator.style.transition = "opacity 0.5s";
    indicator.style.opacity = "0";
    setTimeout(() => {
      indicator.remove();
    }, 500);
  }, 3000);
};
