// @ts-check

/**
 * Loads a component from a URL and inserts it into the DOM.
 * @param {string} url - The URL of the component.
 * @param {string} [containerId] - The ID of the container element.
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
 * Loads all UI components.
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
  ]);
};
