// @ts-check

/**
 * URL에서 컴포넌트를 로드하고 DOM에 삽입합니다.
 * @param {string} url - 컴포넌트의 URL.
 * @param {string} [containerId] - 컨테이너 요소의 ID.
 * @returns {Promise<void>}
 */
export const loadComponent = async (url, containerId) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const html = await response.text();

    if (containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        container.outerHTML = html;
      } else {
        console.warn(`Container #${containerId} not found for ${url}`);
      }
    } else {
      const div = document.createElement("div");
      div.innerHTML = html;
      while (div.firstChild) {
        document.body.appendChild(div.firstChild);
      }
    }
  } catch (error) {
    console.error(`Failed to load component: ${url}`, error);
  }
};

/**
 * 모든 UI 컴포넌트를 로드합니다.
 * @returns {Promise<void>}
 */
export const loadAllComponents = async () => {
  await Promise.all([
    loadComponent("components/sidebar.html", "sidebar-placeholder"),
    loadComponent("components/settings-modal.html"),
    loadComponent("components/keyboard-modal.html"),
    loadComponent("components/web-llm.html"),
    loadComponent("components/related-modal.html"),
    loadComponent("components/dev-modal.html"),
    loadComponent("components/lightboxes.html"),
    loadComponent("components/integrity-check-modal.html"),
    loadComponent("components/result-alert-modal.html"),
    loadComponent("components/arca-panel.html"),
    loadComponent("components/region-modal.html"),
    loadComponent("components/quest-guide-panel.html"),
  ]);
};
